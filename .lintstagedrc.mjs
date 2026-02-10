export default {
  'web/**/*.{js,jsx,ts,tsx}': (filenames) => {
    const files = filenames
      .map(f => {
        const match = f.match(/web\/(.+)$/);
        return match ? match[1] : f;
      })
      .filter(f => f)
      .map(f => `'${f.replace(/'/g, "'\\''")}'`)
      .join(' ');
    return files ? `bash -c "cd web && eslint --fix --no-warn-ignored ${files}"` : [];
  },
  'ingest/**/*.{js,ts}': (filenames) => {
    const files = filenames
      .map(f => {
        const match = f.match(/ingest\/(.+)$/);
        return match ? match[1] : f;
      })
      .filter(f => f)
      .map(f => `'${f.replace(/'/g, "'\\''")}'`)
      .join(' ');
    return files ? `bash -c "cd ingest && eslint --fix --no-warn-ignored ${files}"` : [];
  },
  'shared/**/*.{js,ts}': (filenames) => {
    const files = filenames
      .map(f => {
        const match = f.match(/shared\/(.+)$/);
        return match ? match[1] : f;
      })
      .filter(f => f)
      .map(f => `'${f.replace(/'/g, "'\\''")}'`)
      .join(' ');
    return files ? `bash -c "cd shared && eslint --fix --no-warn-ignored ${files}"` : [];
  },
};
