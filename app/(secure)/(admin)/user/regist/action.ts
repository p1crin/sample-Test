export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getTagOptions(): Promise<Result<{ value: string, label: string }[]>> {
  try {
    const tagOptions = [
      { value: 'タグA', label: 'タグA' },
      { value: 'タグB', label: 'タグB' },
      { value: 'タグC', label: 'タグC' },
      { value: 'タグD', label: 'タグD' },
      { value: 'タグE', label: 'タグE' },
      { value: 'タグF', label: 'タグF' },
    ];

    return { success: true, data: tagOptions };
  } catch (error) {
    console.error('Error fetching tag options:', error);
    return { success: false, error: 'Failed to fetch tag options.' };
  }
}