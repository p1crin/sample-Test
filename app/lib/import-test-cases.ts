import { query, transaction } from './db';
import { parseCSV, csvToObjects, validateCSVData } from './csv-parser';

interface TestCaseCSVRow {
  tid: string;
  first_layer?: string;
  second_layer?: string;
  third_layer?: string;
  fourth_layer?: string;
  purpose?: string;
  request_id?: string;
  check_items?: string;
  test_procedure?: string;
  test_case_no: string;
  test_case?: string;
  expected_value?: string;
  is_target?: string; // 'TRUE' or 'FALSE'
}

export interface TestCaseImportResult {
  successCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
}

/**
 * Import test cases from CSV content
 * CSV format: tid, first_layer, second_layer, third_layer, fourth_layer, purpose,
 *             request_id, check_items, test_procedure, test_case_no, test_case,
 *             expected_value, is_target
 */
export async function importTestCasesFromCSV(
  testGroupId: number,
  csvContent: string
): Promise<TestCaseImportResult> {
  const errors: { row: number; message: string }[] = [];
  let successCount = 0;

  try {
    // Parse CSV
    const rows = parseCSV(csvContent);
    if (rows.length === 0) {
      throw new Error('CSVファイルが空です');
    }

    const testCases = csvToObjects<TestCaseCSVRow>(rows);

    // Validate required fields
    const validation = validateCSVData<TestCaseCSVRow>(testCases, ['tid', 'test_case_no']);
    errors.push(...validation.errors);

    // Group test contents by TID
    const testCaseMap = new Map<string, TestCaseCSVRow[]>();
    for (const tc of validation.data) {
      if (!testCaseMap.has(tc.tid)) {
        testCaseMap.set(tc.tid, []);
      }
      testCaseMap.get(tc.tid)!.push(tc);
    }

    // Process each test case (TID)
    for (const [tid, contents] of testCaseMap.entries()) {
      try {
        // Use first row for test case metadata
        const firstRow = contents[0];

        await transaction(async (client) => {
          // Check if test case already exists
          const existing = await client.query(
            'SELECT tid FROM tt_test_cases WHERE test_group_id = $1 AND tid = $2 AND is_deleted = FALSE',
            [testGroupId, tid]
          );

          if (existing.rows.length > 0) {
            // Update existing test case
            await client.query(
              `UPDATE tt_test_cases
               SET first_layer = $1, second_layer = $2, third_layer = $3, fourth_layer = $4,
                   purpose = $5, request_id = $6, check_items = $7, test_procedure = $8,
                   updated_at = CURRENT_TIMESTAMP
               WHERE test_group_id = $9 AND tid = $10`,
              [
                firstRow.first_layer || null,
                firstRow.second_layer || null,
                firstRow.third_layer || null,
                firstRow.fourth_layer || null,
                firstRow.purpose || null,
                firstRow.request_id || null,
                firstRow.check_items || null,
                firstRow.test_procedure || null,
                testGroupId,
                tid,
              ]
            );

            // Delete existing test contents
            await client.query(
              'DELETE FROM tt_test_contents WHERE test_group_id = $1 AND tid = $2',
              [testGroupId, tid]
            );
          } else {
            // Insert new test case
            await client.query(
              `INSERT INTO tt_test_cases
               (test_group_id, tid, first_layer, second_layer, third_layer, fourth_layer,
                purpose, request_id, check_items, test_procedure, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [
                testGroupId,
                tid,
                firstRow.first_layer || null,
                firstRow.second_layer || null,
                firstRow.third_layer || null,
                firstRow.fourth_layer || null,
                firstRow.purpose || null,
                firstRow.request_id || null,
                firstRow.check_items || null,
                firstRow.test_procedure || null,
              ]
            );
          }

          // Insert test contents
          for (const content of contents) {
            const testCaseNo = parseInt(content.test_case_no);
            if (isNaN(testCaseNo)) {
              errors.push({
                row: -1,
                message: `TID ${tid}: test_case_noは数値である必要があります`,
              });
              continue;
            }

            const isTarget = content.is_target
              ? content.is_target.toUpperCase() === 'TRUE'
              : true;

            await client.query(
              `INSERT INTO tt_test_contents
               (test_group_id, tid, test_case_no, test_case, expected_value, is_target,
                created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [
                testGroupId,
                tid,
                testCaseNo,
                content.test_case || null,
                content.expected_value || null,
                isTarget,
              ]
            );
          }
        });

        successCount += contents.length;
      } catch (error) {
        console.error(`Error importing test case ${tid}:`, error);
        errors.push({
          row: -1,
          message: `TID ${tid}: ${error instanceof Error ? error.message : 'インポートに失敗しました'}`,
        });
      }
    }

    return {
      successCount,
      errorCount: errors.length,
      errors,
    };
  } catch (error) {
    console.error('Test case CSV import error:', error);
    throw error;
  }
}
