import express from "express";
import compression from "compression";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { createServer as createHttpServer } from "http";
import type { AddressInfo } from "net";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  app.use(compression());
  const preferredPort = Number.parseInt(process.env.PORT || "3000", 10);

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const jobs = new Map<string, { status: string, outputPath: string, inputPath: string, error?: string }>();

  app.post("/api/compress/start", upload.single("pdf"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    const { level } = req.body;
    let pdfSettings = "/ebook"; // default to medium quality
    
    if (level === "low") {
      pdfSettings = "/screen"; // lowest quality, smallest file
    } else if (level === "high") {
      pdfSettings = "/printer"; // highest quality, largest file
    }

    const inputPath = req.file.path;
    const jobId = Date.now() + "-" + Math.random().toString(36).substring(7);
    const outputPath = path.join(uploadDir, `compressed-${jobId}.pdf`);

    jobs.set(jobId, { status: "processing", inputPath, outputPath });
    res.json({ jobId });

    // Process in background
    (async () => {
      try {
        // Run Ghostscript to compress the PDF
        // Subsample downsampling is much faster than default Bicubic
        const command = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=${pdfSettings} -dColorImageDownsampleType=/Subsample -dGrayImageDownsampleType=/Subsample -dMonoImageDownsampleType=/Subsample -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`;
        
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);
        
        await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
        
        const job = jobs.get(jobId);
        if (job) job.status = "done";
      } catch (error: any) {
        console.error("Compression error:", error);
        const job = jobs.get(jobId);
        if (job) {
          job.status = "error";
          job.error = error.message;
        }
      }
    })();
  });

  app.get("/api/compress/status/:jobId", (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json({ status: job.status, error: job.error });
  });

  app.get("/api/compress/download/:jobId", (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job || job.status !== "done") {
      return res.status(400).json({ error: "Job not ready or failed" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="compressed.pdf"`);
    
    const stream = fs.createReadStream(job.outputPath);
    stream.pipe(res);
    
    stream.on("end", () => {
      try {
        if (fs.existsSync(job.inputPath)) fs.unlinkSync(job.inputPath);
        if (fs.existsSync(job.outputPath)) fs.unlinkSync(job.outputPath);
        jobs.delete(req.params.jobId);
      } catch (cleanupError) {}
    });
    
    stream.on("error", (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download file" });
      }
    });
  });

  app.post("/api/pdf2img", upload.single("pdf"), async (req, res) => {
    if (!req.file) return res.status(400).send("No PDF file uploaded");

    const format = req.body.format || "svg"; // "svg" or "png"
    const inputPath = req.file.path;
    
    try {
      const mupdf = await import("mupdf");
      let pdfBytes;
      try {
        pdfBytes = fs.readFileSync(inputPath);
      } catch (e) {
        throw new Error("Failed to read uploaded file: " + String(e));
      }
      
      let doc;
      try {
        doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");
      } catch (e) {
        throw new Error("mupdf failed to open document: " + String(e));
      }

      const count = doc.countPages();
      if (count === 0) {
        throw new Error("The PDF document contains 0 pages according to mupdf.");
      }
      
      res.setHeader("Content-Type", "application/json");
      res.write('{"format":"' + format + '","pages":[');
      
      let lastError;
      let streamedCount = 0;
      
      try {
        for (let i = 0; i < count; i++) {
          // Yield the event loop so the server doesn't freeze and fail health checks
          await new Promise(resolve => setTimeout(resolve, 10));
          
          let page;
          try {
            page = doc.loadPage(i);
            
            let pageDataString = "";
            if (format === "svg") {
              const outData = new mupdf.Buffer();
              const drw = new mupdf.DocumentWriter(outData, "svg", "");
              let dev;
              
              try {
                let bounds;
                try {
                  bounds = page.getBounds();
                  if (!Array.isArray(bounds) || bounds.length !== 4) {
                     bounds = [0, 0, 595, 842];
                  }
                } catch(e) {
                  bounds = [0, 0, 595, 842];
                }

                dev = drw.beginPage(bounds);
                page.run(dev, mupdf.Matrix.identity);
                dev.close();
                drw.endPage();
                drw.close();
                pageDataString = Buffer.from(outData.asUint8Array()).toString("utf8");
              } finally {
                if (dev) dev.destroy();
                if (drw) drw.destroy();
                if (outData) outData.destroy();
              }
            } else {
              const scale = 300 / 72;
              const matrix = mupdf.Matrix.scale(scale, scale);
              const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, true, false);
              try {
                const pngBytes = pixmap.asPNG();
                pageDataString = Buffer.from(pngBytes).toString("base64");
              } finally {
                if (pixmap) pixmap.destroy();
              }
            }
            
            if (pageDataString) {
              if (streamedCount > 0) res.write(',');
              res.write(JSON.stringify(pageDataString));
              streamedCount++;
            }
          } catch (pageErr) {
            lastError = pageErr;
            console.error(`Error processing page ${i}:`, pageErr);
          } finally {
            if (page) page.destroy();
          }
        }
      } finally {
        if (doc) doc.destroy();
      }
      
      res.write(']}');
      res.end();
    } catch (error) {
      console.error("Conversion error:", error);
      res.status(500).send(String(error instanceof Error ? error.message : error));
    } finally {
      try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      } catch(e) {}
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: { server: httpServer },
        hmr: process.env.DISABLE_HMR === "true" ? false : { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  let activePort = preferredPort;

  while (true) {
    try {
      await new Promise<void>((resolve, reject) => {
        const handleListening = () => {
          httpServer.off("error", handleError);
          resolve();
        };

        const handleError = (error: NodeJS.ErrnoException) => {
          httpServer.off("listening", handleListening);
          reject(error);
        };

        httpServer.once("listening", handleListening);
        httpServer.once("error", handleError);
        httpServer.listen(activePort, "0.0.0.0");
      });

      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") {
        throw error;
      }

      activePort += 1;
    }
  }

  const address = httpServer.address() as AddressInfo | null;
  const boundPort = address?.port ?? activePort;

  if (boundPort !== preferredPort) {
    console.warn(`Port ${preferredPort} is busy, using http://localhost:${boundPort} instead.`);
  }

  console.log(`Server running on http://localhost:${boundPort}`);
}

startServer();
