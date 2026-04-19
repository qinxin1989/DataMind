---
name: word
description: Word 文档读取、创建、编辑、报告生成和 OOXML 工作流能力，兼容旧版 word skill 的动作命名
version: 1.0.0
adapter: legacy_skills
actions:
  - name: read_word
    description: 读取 Word 文档
  - name: create_word_document
    description: 创建 Word 文档
  - name: update_word_content
    description: 替换文档内容
  - name: append_to_word
    description: 追加内容
  - name: generate_word_report
    description: 生成报告
  - name: add_table_to_word
    description: 添加表格
  - name: add_image_to_word
    description: 添加图片
  - name: unpack_word
    description: 解包 Word 为 OOXML 目录
  - name: pack_word
    description: 从 OOXML 目录重新打包 Word
  - name: inspect_word_xml
    description: 查看 Word 包内 XML / rels 内容
  - name: validate_word_package
    description: 校验 OOXML 目录关键结构
  - name: add_comment_to_word
    description: 在解包目录里添加批注
  - name: reply_to_word_comment
    description: 回复已有批注
  - name: suggest_deletion_in_word
    description: 添加 tracked deletion（红线删除）
  - name: track_replace_text_in_word
    description: 添加基础版 tracked replacement（删除+插入）
  - name: revert_insertion_in_word
    description: 拒绝已有插入修订
  - name: revert_deletion_in_word
    description: 恢复已有删除修订
---

兼容说明：
- 旧命名 `word.read_word` 会自动映射到当前 `docx.readWord`
- 旧参数 `output_path`、`report_title`、`sections`、`summary`、`doc_path`、`image_path`、`table_data` 可继续使用
- `unpack_word / pack_word / inspect_word_xml / validate_word_package` 会映射到当前 docx OOXML 动作
- `add_comment_to_word / reply_to_word_comment / suggest_deletion_in_word / revert_insertion_in_word / revert_deletion_in_word` 会映射到当前 docx 高级修订动作
- `track_replace_text_in_word` 会映射到当前 docx 的基础红线替换动作

适合场景：
- 提取 `.docx` 正文
- 生成新的会议纪要、制度草稿、分析报告
- 将结构化章节内容导出为 Word 文档
- 在已有文档里做替换、续写、插表和插图
- 对 `word/document.xml`、`comments.xml`、关系文件做深入排查或后续红线修订准备
- 在解包目录里按行号做批注、基础红线删除和修订回退
- 在单个文本 run 内做基础红线替换
