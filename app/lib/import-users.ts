import bcrypt from 'bcryptjs';
import { query, transaction } from './db';
import { parseCSV, csvToObjects, validateCSVData, CSVParseResult } from './csv-parser';
import { UserRole } from '../types/database';

interface UserCSVRow {
  email: string;
  password: string;
  user_role: string;
  department?: string;
  company?: string;
  tags?: string; // Comma-separated tag names
}

export interface UserImportResult {
  successCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
}

/**
 * Import users from CSV content
 * CSV format: email, password, user_role, department, company, tags
 */
export async function importUsersFromCSV(
  csvContent: string,
  importedBy: string
): Promise<UserImportResult> {
  const errors: { row: number; message: string }[] = [];
  let successCount = 0;

  try {
    // Parse CSV
    const rows = parseCSV(csvContent);
    if (rows.length === 0) {
      throw new Error('CSVファイルが空です');
    }

    const users = csvToObjects<UserCSVRow>(rows);

    // Validate required fields (password is optional for existing users)
    const validation = validateCSVData<UserCSVRow>(users, ['email', 'user_role']);
    errors.push(...validation.errors);

    // Process each valid user
    for (let i = 0; i < validation.data.length; i++) {
      const user = validation.data[i];
      const rowNumber = i + 2; // Account for header row

      try {
        // Validate user_role
        const userRole = parseInt(user.user_role);
        if (isNaN(userRole) || userRole < 0 || userRole > 2) {
          errors.push({
            row: rowNumber,
            message: 'user_roleは0（管理者）、1（テスト管理者）、または2（一般）である必要があります',
          });
          continue;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(user.email)) {
          errors.push({
            row: rowNumber,
            message: '無効なメールアドレス形式です',
          });
          continue;
        }

        // Check if user already exists
        const existingUser = await query(
          'SELECT id FROM mt_users WHERE email = $1 AND is_deleted = FALSE',
          [user.email]
        );

        const isUpdate = existingUser.rows.length > 0;
        let userId: number = isUpdate ? existingUser.rows[0].id : 0;

        // For new users, password is required
        if (!isUpdate && (!user.password || user.password.trim() === '')) {
          errors.push({
            row: rowNumber,
            message: '新規ユーザーの場合、パスワードは必須です',
          });
          continue;
        }

        // Hash password if provided
        let passwordHash: string | null = null;
        if (user.password && user.password.trim() !== '') {
          passwordHash = await bcrypt.hash(user.password, 10);
        }

        // Insert or update user and tags in transaction
        await transaction(async (client) => {
          if (isUpdate) {
            // Update existing user
            if (passwordHash) {
              // Update with new password
              await client.query(
                `UPDATE mt_users
                 SET user_role = $1, department = $2, company = $3, password = $4, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $5`,
                [userRole, user.department || null, user.company || null, passwordHash, userId]
              );
            } else {
              // Update without changing password
              await client.query(
                `UPDATE mt_users
                 SET user_role = $1, department = $2, company = $3, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4`,
                [userRole, user.department || null, user.company || null, userId]
              );
            }

            // Delete existing tags
            await client.query('DELETE FROM mt_user_tags WHERE user_id = $1', [userId]);
          } else {
            // Insert new user
            const userResult = await client.query(
              `INSERT INTO mt_users (email, password, user_role, department, company, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
               RETURNING id`,
              [user.email, passwordHash, userRole, user.department || null, user.company || null]
            );

            userId = userResult.rows[0].id;
          }

          // Process tags if provided
          if (user.tags) {
            const tagNames = user.tags
              .split(',')
              .map((t) => t.trim())
              .filter((t) => t.length > 0);

            for (const tagName of tagNames) {
              // Get or create tag
              const tagResult = await client.query(
                'SELECT id FROM mt_tags WHERE name = $1 AND is_deleted = FALSE',
                [tagName]
              );

              let tagId: number;
              if (tagResult.rows.length === 0) {
                // Create new tag
                const newTag = await client.query(
                  `INSERT INTO mt_tags (name, created_at, updated_at)
                   VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                   RETURNING id`,
                  [tagName]
                );
                tagId = newTag.rows[0].id;
              } else {
                tagId = tagResult.rows[0].id;
              }

              // Associate tag with user
              await client.query(
                'INSERT INTO mt_user_tags (user_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [userId, tagId]
              );
            }
          }
        });

        successCount++;
      } catch (error) {
        console.error(`Error importing user at row ${rowNumber}:`, error);
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'ユーザーのインポートに失敗しました',
        });
      }
    }

    return {
      successCount,
      errorCount: errors.length,
      errors,
    };
  } catch (error) {
    console.error('CSV import error:', error);
    throw error;
  }
}
