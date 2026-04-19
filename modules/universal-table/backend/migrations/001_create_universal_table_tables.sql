CREATE TABLE IF NOT EXISTS ut_standard_categories (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ut_category_user_name (user_id, name)
);

CREATE TABLE IF NOT EXISTS ut_standard_tables (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(128) DEFAULT '其他',
  columns_json LONGTEXT NOT NULL,
  header_examples_json LONGTEXT NULL,
  source VARCHAR(32) DEFAULT 'manual',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ut_projects (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status VARCHAR(32) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ut_project_files (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_ext VARCHAR(32) NOT NULL,
  mime_type VARCHAR(191) NULL,
  file_size BIGINT DEFAULT 0,
  original_path TEXT NOT NULL,
  masked_path TEXT NULL,
  test_path TEXT NULL,
  sample_text LONGTEXT NULL,
  headers_json LONGTEXT NULL,
  preview_rows_json LONGTEXT NULL,
  total_rows INT DEFAULT 0,
  standard_table_id VARCHAR(36) NULL,
  standard_table_name VARCHAR(255) NULL,
  classification_confidence DECIMAL(6, 3) DEFAULT 0,
  classification_status VARCHAR(32) DEFAULT 'pending',
  mask_status VARCHAR(32) DEFAULT 'pending',
  test_status VARCHAR(32) DEFAULT 'pending',
  collection_status VARCHAR(32) DEFAULT 'pending',
  latest_mapping_json LONGTEXT NULL,
  latest_script_id VARCHAR(36) NULL,
  latest_result_id VARCHAR(36) NULL,
  error_message TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ut_collection_scripts (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  standard_table_id VARCHAR(36) NULL,
  sample_file_id VARCHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  sample_source VARCHAR(32) DEFAULT 'masked',
  source_format VARCHAR(32) NULL,
  script_body LONGTEXT NOT NULL,
  metadata_json LONGTEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ut_collection_results (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  file_id VARCHAR(36) NOT NULL,
  script_id VARCHAR(36) NOT NULL,
  status VARCHAR(32) DEFAULT 'completed',
  detected_headers_json LONGTEXT NULL,
  output_headers_json LONGTEXT NULL,
  preview_rows_json LONGTEXT NULL,
  output_path TEXT NULL,
  mapping_json LONGTEXT NULL,
  mapping_status VARCHAR(32) DEFAULT 'auto',
  manual_confirmation_required TINYINT(1) DEFAULT 0,
  datasource_id VARCHAR(36) NULL,
  analysis_table_name VARCHAR(64) NULL,
  ingested_row_count INT DEFAULT 0,
  error_message TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ut_analysis_datasets (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  standard_table_id VARCHAR(36) NOT NULL,
  standard_table_name VARCHAR(255) NOT NULL,
  analysis_table_name VARCHAR(64) NOT NULL,
  datasource_id VARCHAR(36) NOT NULL,
  datasource_name VARCHAR(255) NOT NULL,
  last_result_id VARCHAR(36) NULL,
  row_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ut_analysis_dataset (project_id, standard_table_id)
);
