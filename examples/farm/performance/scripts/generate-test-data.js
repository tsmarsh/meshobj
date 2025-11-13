#!/usr/bin/env node
/**
 * Quick data generator for stress test
 * Generates: 10 farms, 1000 coops, 100K hens, 10M lay_reports
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3033';

async function post(path, data) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`POST ${path} failed: ${response.status}`);
  }

  if (Array.isArray(data)) {
    // Bulk response returns array of URLs
    return await response.json();
  }

  const location = response.headers.get('location');
  if (location) {
    return location.split('/').pop();
  }
  return await response.json();
}

async function main() {
  console.log('Creating farms (bulk)...');
  const farms = Array.from({ length: 10 }, (_, i) => ({ name: `Farm-${i + 1}` }));
  const farmUrls = await post('/farm/api/bulk', farms);
  const farmIds = farmUrls.map(url => url.split('/').pop());
  console.log(`✓ Created ${farmIds.length} farms`);

  console.log('Creating coops (bulk, 100 per farm)...');
  const allCoopIds = [];
  for (const farmId of farmIds) {
    const coops = Array.from({ length: 100 }, (_, i) => ({
      name: `${farmId.slice(0, 8)}-Coop-${i + 1}`,
      farm_id: farmId,
    }));
    const coopUrls = await post('/coop/api/bulk', coops);
    allCoopIds.push(...coopUrls.map(url => url.split('/').pop()));
  }
  console.log(`✓ Created ${allCoopIds.length} coops`);

  console.log('Creating hens (bulk, 100 per coop)...');
  const allHenIds = [];
  let henCounter = 0;
  for (let i = 0; i < allCoopIds.length; i++) {
    const coopId = allCoopIds[i];
    const hens = Array.from({ length: 100 }, () => ({
      name: `Hen-${henCounter++}`,
      coop_id: coopId,
      eggs: Math.floor(Math.random() * 11),
      dob: '2024-01-01',
    }));
    const henUrls = await post('/hen/api/bulk', hens);
    allHenIds.push(...henUrls.map(url => url.split('/').pop()));

    if ((i + 1) % 100 === 0) {
      console.log(`  Processed ${i + 1}/${allCoopIds.length} coops`);
    }
  }
  console.log(`✓ Created ${allHenIds.length} hens`);

  console.log('Creating lay reports (bulk, 100 per hen)...');
  const timeOfDays = ['morning', 'afternoon', 'evening'];
  let totalReports = 0;

  for (let i = 0; i < allHenIds.length; i++) {
    const henId = allHenIds[i];
    const reports = Array.from({ length: 100 }, () => ({
      hen_id: henId,
      time_of_day: timeOfDays[Math.floor(Math.random() * 3)],
      eggs: Math.floor(Math.random() * 4),
    }));

    // Post in batches of 500
    for (let batch = 0; batch < reports.length; batch += 500) {
      const batchReports = reports.slice(batch, batch + 500);
      await post('/lay_report/api/bulk', batchReports);
      totalReports += batchReports.length;
    }

    if ((i + 1) % 1000 === 0) {
      console.log(`  Processed ${i + 1}/${allHenIds.length} hens (${totalReports} reports)`);
    }
  }
  console.log(`✓ Created ${totalReports} lay reports`);

  console.log('\n=== Data Generation Complete ===');
  console.log(`Farms: ${farmIds.length}`);
  console.log(`Coops: ${allCoopIds.length}`);
  console.log(`Hens: ${allHenIds.length}`);
  console.log(`Lay Reports: ${totalReports}`);
  console.log('\nSample IDs for testing:');
  console.log(`  Farm: ${farmIds[0]}`);
  console.log(`  Coop: ${allCoopIds[0]}`);
  console.log(`  Hen: ${allHenIds[0]}`);
}

main().catch(console.error);
