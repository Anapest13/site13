import mysql from 'mysql2/promise';

async function testPort(port: number) {
  console.log(`Testing port ${port}...`);
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: port,
      user: 'root',
      password: 'root',
      database: 'bookcity',
      connectTimeout: 2000
    });
    console.log(`Successfully connected to port ${port}!`);
    await connection.end();
    return true;
  } catch (error: any) {
    console.log(`Failed to connect to port ${port}: ${error.message}`);
    return false;
  }
}

async function run() {
  const ports = [8000, 8080, 24678, 3306, 33060, 3001];
  for (const port of ports) {
    await testPort(port);
  }
}

run();
