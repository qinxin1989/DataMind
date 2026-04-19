---
name: pptx
description: PPTX 清单分析、文本替换、幻灯片重排、解包/回包与结构校验能力，兼容旧版 pptx skill 的动作命名
version: 1.0.0
adapter: legacy_skills
actions:
  - name: inventory
    description: 提取 PPTX 幻灯片目录和内容摘要
  - name: save_inventory
    description: 将目录结果保存为 JSON 文件
  - name: replace_text
    description: 批量替换 PPTX 内文本
  - name: rearrange
    description: 按指定顺序重排幻灯片
  - name: unpack
    description: 解包 PPTX 为 OOXML 目录
  - name: pack
    description: 将 OOXML 目录重新打包为 PPTX
  - name: validate
    description: 校验解包目录是否具备 PPTX 关键结构
---

建议流程：
- 先 `inventory` 看整份 PPT 的结构和每页主题
- 大批量修字时用 `replace_text`
- 需要调换顺序时用 `rearrange`
- 复杂排查或人工微调时，先 `unpack`，再修改目录，最后 `validate` + `pack`

实现说明：
- 当前实现使用 `JSZip` 直接处理 PPTX 的 OOXML 结构
- 适合标题、正文、备注等文本级调整，不适合复杂版式重绘

兼容说明：
- 旧命名 `pptx.inventory`、`pptx.save_inventory`、`pptx.replace_text`、`pptx.rearrange`、`pptx.unpack`、`pptx.pack`、`pptx.validate` 可继续使用
- `input_path`、`output_path`、`slide_order`、`unpacked_dir` 等旧参数名仍可沿用
