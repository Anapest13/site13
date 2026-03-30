import mysql from 'mysql2/promise';

async function test() {
  const hosts = ['localhost', '127.0.0.1', 'mysql', 'db'];
  const ports = [3001, 3306, 33060];
  for (const host of hosts) {
    for (const port of ports) {
      console.log(`Testing ${host}:${port}...`);
      try {
        const connection = await mysql.createConnection({
          host,
          user: 'root',
          password: 'root',
          database: 'bookcity',
          port,
          connectTimeout: 5000
        });
        console.log(`SUCCESS: Connected to ${host}:${port}`);
        await connection.end();
      } catch (err) {
        console.log(`FAILED: ${host}:${port} - ${(err as Error).message}`);
      }
    }
  }
}

test();
