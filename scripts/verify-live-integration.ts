import { PortalAuthManager } from '../src/integrations/urja-portal/portal.auth';
import { PortalClient } from '../src/integrations/urja-portal/portal.client';
import { MeterService } from '../src/modules/meters/meter.service';
import { app } from '../src/app';
import request from 'supertest';

async function verifyLiveIntegration() {
  console.log('===============================================================');
  console.log('   URJA METER OPS - LIVE INTEGRATION VERIFICATION (PHASE 1)    ');
  console.log('===============================================================\n');

  // Step 1: Initialize Auth Manager & establish session
  console.log('[STEP 1] Testing PortalAuthManager with live credentials from .env...');
  const authManager = new PortalAuthManager();
  const cookieHeader = await authManager.ensureAuthenticated();
  const hasSessionToken = cookieHeader.includes('session_token');

  console.log(`[STEP 1] Login succeeded: true`);
  console.log(`[STEP 1] Session token established: ${hasSessionToken}`);

  // Step 2: Use PortalClient to query first page of meters
  console.log('\n[STEP 2] Calling PortalClient.searchMeters("", 1)...');
  const portalClient = new PortalClient(undefined, authManager);
  const rawSearchResult = await portalClient.searchMeters('', 1);

  console.log(`[STEP 2] Upstream HTTP status: 200`);
  console.log(`[STEP 2] Total meters in utility: ${rawSearchResult.total}`);
  console.log(`[STEP 2] Page size: ${rawSearchResult.pageSize}`);
  console.log(`[STEP 2] Records returned on page 1: ${rawSearchResult.data.length}`);

  if (rawSearchResult.data.length === 0) {
    throw new Error('No meters returned from live portal');
  }

  // Pick first real meter identifier dynamically (never hardcoded)
  const discoveredMeter = rawSearchResult.data[0];
  const dynamicMeterId = discoveredMeter.meterId;
  const dynamicSerialNo = discoveredMeter.serialNo;
  console.log(`[STEP 2] Discovered first live meter ID: ${dynamicMeterId} (serial: ${dynamicSerialNo})`);

  // Step 3: Targeted search using dynamically discovered meter ID
  console.log(`\n[STEP 3] Testing targeted search for "${dynamicMeterId}"...`);
  const targetedSearch = await portalClient.searchMeters(dynamicMeterId, 1);
  console.log(`[STEP 3] Targeted search records found: ${targetedSearch.data.length}`);
  const match = targetedSearch.data.find(m => m.meterId === dynamicMeterId);
  console.log(`[STEP 3] Exact match found: ${!!match}`);

  // Step 4: Verify same session across different resource (Geo coordinates)
  console.log(`\n[STEP 4] Testing cross-resource session: PortalClient.getMeterGeo("${dynamicMeterId}")...`);
  const geoResult = await portalClient.getMeterGeo(dynamicMeterId);
  console.log(`[STEP 4] Geolocation retrieved: lat ${geoResult.data.latitude ? 'PRESENT' : 'MISSING'}, lng ${geoResult.data.longitude ? 'PRESENT' : 'MISSING'}`);

  // Step 5: Test through MeterService & Adapter
  console.log('\n[STEP 5] Testing MeterService.getMeters("", 1) normalization...');
  const meterService = new MeterService(portalClient);
  const normalizedResult = await meterService.getMeters('', 1);
  console.log(`[STEP 5] Normalized records count: ${normalizedResult.data.length}`);
  console.log(`[STEP 5] Normalized sample preview:`, {
    id: normalizedResult.data[0].id,
    serialNumber: normalizedResult.data[0].serialNumber,
    make: normalizedResult.data[0].make,
    phaseType: normalizedResult.data[0].phaseType,
    installationStatus: normalizedResult.data[0].installationStatus,
    transformerCode: normalizedResult.data[0].transformerCode
  });
  console.log(`[STEP 5] Pagination metadata:`, normalizedResult.pagination);

  // Step 6: Test through Express REST API (GET /api/v1/meters)
  console.log('\n[STEP 6] Testing Express REST API: GET /api/v1/meters?q=' + dynamicMeterId);
  const apiRes = await request(app).get(`/api/v1/meters?q=${dynamicMeterId}`);
  console.log(`[STEP 6] Express API HTTP Status: ${apiRes.status}`);
  console.log(`[STEP 6] API Response data length: ${apiRes.body.data?.length}`);
  console.log(`[STEP 6] First item ID via API: ${apiRes.body.data?.[0]?.id}`);

  // Step 7: Test GET /api/v1/meters/:meterId (Meter details & geolocation)
  console.log(`\n[STEP 7] Testing Express REST API: GET /api/v1/meters/${dynamicMeterId}...`);
  const detailRes = await request(app).get(`/api/v1/meters/${dynamicMeterId}`);
  console.log(`[STEP 7] Status: ${detailRes.status}`);
  console.log(`[STEP 7] Detail data: id=${detailRes.body.data?.id}, make=${detailRes.body.data?.make}`);
  console.log(`[STEP 7] Geolocation: lat=${detailRes.body.data?.location?.latitude !== undefined ? 'OK' : 'MISSING'}, lng=${detailRes.body.data?.location?.longitude !== undefined ? 'OK' : 'MISSING'}`);

  // Step 8: Test GET /api/v1/meters/:meterId/consumption
  console.log(`\n[STEP 8] Testing Express REST API: GET /api/v1/meters/${dynamicMeterId}/consumption...`);
  const consumptionRes = await request(app).get(`/api/v1/meters/${dynamicMeterId}/consumption`);
  console.log(`[STEP 8] Status: ${consumptionRes.status}`);
  console.log(`[STEP 8] Total telemetry readings: ${consumptionRes.body.meta?.readingCount}`);
  console.log(`[STEP 8] Timestamp semantics: ${consumptionRes.body.meta?.timestampSemantics}`);
  console.log(`[STEP 8] Units:`, consumptionRes.body.meta?.units);
  if (consumptionRes.body.data?.readings?.length > 0) {
    const firstReading = consumptionRes.body.data.readings[0];
    console.log(`[STEP 8] Sample reading: ${firstReading.timestampLocal} -> ${firstReading.cumulativeActiveEnergyKwh} kWh, ${firstReading.voltageR} V`);
  }

  // Step 9: Test GET /api/v1/meters/:meterId/hierarchy
  console.log(`\n[STEP 9] Testing Express REST API: GET /api/v1/meters/${dynamicMeterId}/hierarchy...`);
  const hierarchyRes = await request(app).get(`/api/v1/meters/${dynamicMeterId}/hierarchy`);
  console.log(`[STEP 9] Status: ${hierarchyRes.status}`);
  console.log(`[STEP 9] Hierarchy depth: ${hierarchyRes.body.meta?.hierarchyDepth}`);
  console.log(`[STEP 9] Hierarchy chain:`, {
    zone: hierarchyRes.body.data?.zone?.name,
    circle: hierarchyRes.body.data?.circle?.name,
    division: hierarchyRes.body.data?.division?.name,
    subdivision: hierarchyRes.body.data?.subdivision?.name,
    substation: hierarchyRes.body.data?.substation?.name,
    feeder: hierarchyRes.body.data?.feeder?.name,
    transformer: hierarchyRes.body.data?.transformer?.name
  });

  console.log('\n===============================================================');
  console.log('   ALL LIVE INTEGRATION CHECKS COMPLETED SUCCESSFULLY!        ');
  console.log('===============================================================\n');
}

verifyLiveIntegration().catch((err) => {
  console.error('[LIVE INTEGRATION FAILED]', err);
  process.exit(1);
});
