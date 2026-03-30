import http from 'http';

function check() {
  http.get('http://localhost:3000/api/health', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        console.log(JSON.stringify(JSON.parse(data), null, 2));
      } catch (err) {
        console.error('Error parsing health check response:', err);
        console.log('Raw data:', data);
      }
    });
  }).on('error', (err) => {
    console.error('Error fetching health check:', err);
  });
}

check();
