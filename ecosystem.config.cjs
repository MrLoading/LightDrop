module.exports = {
  apps: [
    {
      name: 'lightdrop',
      script: './dist/server/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      kill_timeout: 3000,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT ? Number(process.env.PORT) : 8080,
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
