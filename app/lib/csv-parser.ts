// CSV Parser Utility

export interface CSVParseResult<T> {
  data: T[];
  errors: { row: number; message: string }[];
}

/**
 * Parse CSV string to array of objects
 */
export function parseCSV(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  const rows: string[][] = [];

  for (const line of lines) {
    const row: string[] = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Escaped quote
          currentCell += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        // End of cell
        row.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    // Push last cell
    row.push(currentCell.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Convert CSV rows to objects using header row
 */
export function csvToObjects<T>(rows: string[][]): T[] {
  if (rows.length === 0) return [];

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return dataRows.map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    return obj as T;
  });
}

/**
 * Validate required fields in CSV data
 */
export function validateCSVData<T>(
  data: unknown[],
  requiredFields: (keyof T)[]
): CSVParseResult<T> {
  const errors: { row: number; message: string }[] = [];
  const validData: T[] = [];

  data.forEach((item, index) => {
    const rowNumber = index + 2; // +2 because header is row 1, data starts at row 2
    const missingFields: string[] = [];
    const i = item as Record<string, unknown>;

    requiredFields.forEach((field) => {
      const fieldKey = String(field);
      const value = i[fieldKey];
      if (!value || String(value).trim() === '') {
        missingFields.push(field as string);
      }
    });

    if (missingFields.length > 0) {
      errors.push({
        row: rowNumber,
        message: `必須フィールドが不足しています: ${missingFields.join(', ')}`,
      });
    } else {
      validData.push(item as T);
    }
  });

  return { data: validData, errors };
}
