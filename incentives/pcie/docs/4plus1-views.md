# 4+1 架构视图文档

本文档用于满足软件工程规范中的 `4+1` 视图要求，并作为架构演进时的统一更新基线。

## 1. 视图覆盖矩阵

| 视图 | 关注点 | UML 文件 |
|:---|:---|:---|
| 逻辑视图（Logical） | 核心模块职责、依赖方向、边界 | [puml/4plus1-logical-view.puml](./puml/4plus1-logical-view.puml) |
| 开发视图（Development） | 代码组织、目录分层、构建单元 | [puml/4plus1-development-view.puml](./puml/4plus1-development-view.puml) |
| 进程视图（Process） | 关键运行时协作、时序、并发与超时 | [puml/4plus1-process-view.puml](./puml/4plus1-process-view.puml) |
| 物理视图（Physical） | 运行节点、网络边界、部署关系 | [puml/4plus1-physical-view.puml](./puml/4plus1-physical-view.puml) |
| 场景视图（Scenarios） | 关键业务场景如何穿透上述四个视图 | [puml/4plus1-scenarios-view.puml](./puml/4plus1-scenarios-view.puml) |

## 2. 逻辑视图（Logical View）

- 目标：描述系统中稳定的功能模块与依赖关系。
- 重点：前端工作区、服务端网关、本地 OCR、文档转换与文件领域逻辑。
- UML 源码： [puml/4plus1-logical-view.puml](./puml/4plus1-logical-view.puml)

## 3. 开发视图（Development View）

- 目标：描述仓库结构与开发期模块边界。
- 重点：`src/features/files`、`src/server`、`scripts/local-ocr` 的职责归位。
- UML 源码： [puml/4plus1-development-view.puml](./puml/4plus1-development-view.puml)

## 4. 进程视图（Process View）

- 目标：描述运行期协作流程和关键控制点。
- 重点：`/api/ocr/image` 请求链路、worker 常驻、超时与返回。
- UML 源码： [puml/4plus1-process-view.puml](./puml/4plus1-process-view.puml)

## 5. 物理视图（Physical View）

- 目标：描述节点部署与通信边界。
- 重点：Browser、Node/Express、Python/PaddleOCR、本地文件系统与第三方 AI API。
- UML 源码： [puml/4plus1-physical-view.puml](./puml/4plus1-physical-view.puml)

## 6. 场景视图（Scenarios / Use Case View）

- 目标：用关键用例串联系统能力。
- 重点：图片 OCR、Word 转 PDF、AI 对话三条主线。
- UML 源码： [puml/4plus1-scenarios-view.puml](./puml/4plus1-scenarios-view.puml)

## 7. 持续维护规则

1. 任何涉及模块边界、运行时流程、部署方式、主用例变化的改动，都必须同步更新本文件和对应 `.puml`。
2. PR 需包含“4+1 视图影响说明”：`已更新` 或 `无需更新`。
3. 若新增核心能力（例如新文件类型、新推理引擎、新服务节点），应优先补全 5 个视图中的至少 2 个（通常是逻辑 + 进程）。
