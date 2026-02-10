export default {
  'web/**/*.{js,jsx,ts,tsx}': (filenames) => {
    const files = filenames.map(f => f.replace(/.*\/web\//, '')).join(' ');
    return `bash -c "cd web && eslint --fix --no-warn-ignored ${files}"`;
  },
  'ingest/**/*.{js,ts}': (filenames) => {
    const files = filenames.map(f => f.replace(/.*\/ingest\//, '')).join(' ');
    return `bash -c "cd ingest && eslint --fix --no-warn-ignored ${files}"`;
  },
  'shared/**/*.{js,ts}': (filenames) => {
    const files = filenames.map(f => f.replace(/.*\/shared\//, '')).join(' ');
    return `bash -c "cd shared && eslint --fix --no-warn-ignored ${files}"`;
  },
};
