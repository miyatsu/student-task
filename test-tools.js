import { execSync } from 'child_process';
const tools = ['mutool', 'pdftocairo', 'pdf2svg', 'inkscape', 'convert'];
tools.forEach(tool => {
  try {
    console.log(tool, execSync(`which ${tool}`).toString().trim());
  } catch (e) {
    console.log(tool, 'not found');
  }
});
