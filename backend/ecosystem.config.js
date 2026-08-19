module.exports = {
  apps: [
    {
      name: 'crm-api',
      script: 'src/server.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      autorestart: true,
      max_memory_restart: '1G',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      time: true,
      kill_timeout: 5000,
      listen_timeout: 5000,
    }
  ]
};