-- Insert sample tags
INSERT INTO "mt_tags" ("name", "created_at", "updated_at", "is_deleted") VALUES
('Security Testing', NOW(), NOW(), false),
('Performance Testing', NOW(), NOW(), false),
('Integration Testing', NOW(), NOW(), false),
('User Acceptance Testing', NOW(), NOW(), false);

-- Insert sample users
INSERT INTO "mt_users" ("email", "password", "user_role", "department", "company", "created_at", "updated_at", "is_deleted") VALUES
('admin@example.com', '$2b$10$3WSQm1czR3/ukarbN/w5GeToqar./2/BjVMtgGuFP7gwD3JreZO6S', 1, 'QA Management', 'Test Company Inc.', NOW(), NOW(), false),
('manager@example.com', '$2b$10$3WSQm1czR3/ukarbN/w5GeToqar./2/BjVMtgGuFP7gwD3JreZO6S', 1, 'Test Management', 'Test Company Inc.', NOW(), NOW(), false),
('tester1@example.com', '$2b$10$3WSQm1czR3/ukarbN/w5GeToqar./2/BjVMtgGuFP7gwD3JreZO6S', 2, 'QA Engineering', 'Test Company Inc.', NOW(), NOW(), false),
('tester2@example.com', '$2b$10$3WSQm1czR3/ukarbN/w5GeToqar./2/BjVMtgGuFP7gwD3JreZO6S', 2, 'QA Engineering', 'Test Company Inc.', NOW(), NOW(), false);

-- Insert user-tag associations
INSERT INTO "mt_user_tags" ("user_id", "tag_id") VALUES
(1, 1),
(1, 2),
(2, 2),
(2, 3),
(3, 3),
(3, 4),
(4, 1),
(4, 4);

-- Insert sample test groups
INSERT INTO "tt_test_groups" ("oem", "model", "event", "variation", "destination", "specs", "test_startdate", "test_enddate", "ng_plan_count", "created_by", "updated_by", "created_at", "updated_at", "is_deleted") VALUES
('Toyota', 'GR86', 'ECU Control System Test', 'A1-2025', 'Japan Market', 'Engine Control Module v2.1', '2025-01-15', '2025-02-28', 5, 'admin@example.com', 'admin@example.com', NOW(), NOW(), false),
('Honda', 'Civic Type-R', 'Transmission Test Suite', 'B2-2025', 'Europe Market', 'Automatic Transmission v3.0', '2025-02-01', '2025-03-15', 3, 'manager@example.com', 'manager@example.com', NOW(), NOW(), false),
('Mazda', 'CX-5', 'Safety Systems Integration', 'C1-2025', 'North America Market', 'ADAS Package v4.2', '2025-01-20', '2025-04-30', 8, 'admin@example.com', 'admin@example.com', NOW(), NOW(), false);

-- Insert test group-tag associations
INSERT INTO "tt_test_group_tags" ("test_group_id", "tag_id", "test_role") VALUES
(1, 1, 1),
(1, 2, 1),
(2, 2, 1),
(2, 3, 1),
(3, 3, 1),
(3, 4, 1);

-- Insert sample test cases
INSERT INTO "tt_test_cases" ("test_group_id", "tid", "first_layer", "second_layer", "third_layer", "fourth_layer", "purpose", "request_id", "check_items", "test_procedure", "created_at", "updated_at", "is_deleted") VALUES
(1, 'TC-001', 'Engine Control', 'Fuel Injection', 'Pressure Regulation', 'Cold Start', 'Verify cold start fuel injection pressure stability', 'REQ-001', 'Pressure within 3.5-4.5 bar, Response time < 500ms', '1. Start engine at -5C\n2. Monitor fuel pressure\n3. Verify stable operation', NOW(), NOW(), false),
(1, 'TC-002', 'Engine Control', 'Ignition Timing', 'Advance Control', 'Full Throttle', 'Validate ignition timing under full throttle condition', 'REQ-002', 'Timing advance 25-35 degrees, Knock detection active', '1. Full throttle acceleration\n2. Monitor timing advance\n3. Verify knock detection', NOW(), NOW(), false),
(1, 'TC-003', 'Emission Control', 'Catalyst Temperature', 'Warmup Phase', 'Idle Warmup', 'Monitor catalyst temperature during warmup', 'REQ-003', 'Temperature rise < 50C/min, Stable at 600C after 3 minutes', '1. Cold start at idle\n2. Monitor catalyst temp\n3. Record warmup curve', NOW(), NOW(), false);

-- Insert sample test contents
INSERT INTO "tt_test_contents" ("test_group_id", "tid", "test_case_no", "test_case", "expected_value", "is_target", "created_at", "updated_at", "is_deleted") VALUES
(1, 'TC-001', 1, 'Fuel pressure within range', '3.5-4.5 bar', true, NOW(), NOW(), false),
(1, 'TC-001', 2, 'Response time to pressure change', '< 500ms', true, NOW(), NOW(), false),
(1, 'TC-001', 3, 'System stability', 'No oscillation', true, NOW(), NOW(), false);

-- Insert sample test results
INSERT INTO "tt_test_results" ("test_group_id", "tid", "test_case_no", "result", "judgment", "software_version", "hardware_version", "comparator_version", "execution_date", "executor", "note", "version", "created_at", "updated_at", "is_deleted") VALUES
(1, 'TC-001', 1, 'Pressure values recorded: 4.1, 4.2, 4.0 bar', 'PASS', 'ECU_v2.1.0', 'HW_rev_A1', 'COMP_v1.0', '2025-01-20', 'tester1@example.com', 'All measurements within specification', 1, NOW(), NOW(), false),
(1, 'TC-001', 2, 'Response time measured: 380ms average', 'PASS', 'ECU_v2.1.0', 'HW_rev_A1', 'COMP_v1.0', '2025-01-20', 'tester1@example.com', 'Response time well within specification', 1, NOW(), NOW(), false);

-- Insert sample import results
INSERT INTO "tt_import_results" ("file_name", "import_date", "import_status", "executor_name", "import_type", "count", "created_at", "updated_at", "is_deleted") VALUES
('test_cases_batch_001.xlsx', CURRENT_DATE, 1, 'admin@example.com', 1, 25, NOW(), NOW(), false),
('test_results_batch_002.xlsx', CURRENT_DATE, 1, 'manager@example.com', 2, 15, NOW(), NOW(), false);
