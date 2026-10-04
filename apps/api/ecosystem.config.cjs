const os = require("node:os");

// Exactly one instance in fork mode: SQLite wants a single writer and the
// scheduled jobs must not run twice.
module.exports = {
  apps: [
    {
      name: "tick-taka-api",
      script: "src/index.ts",
      cwd: __dirname,
      interpreter: `${os.homedir()}/.bun/bin/bun`,
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "300M",
      env: { NODE_ENV: "production" },
    },
  ],
};
