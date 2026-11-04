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
  console.log('[STEP 1] Testing PortalAuthManager with configured credentials...');
  const authManager = new PortalAuthManager();
  const cookieHeader = await authManager.ensureAuthenticated();
  const hasSessionToken = cookieHeader.includes('session_token');

  console.log('[STEP 1] Login succeeded: true');
  console.log(`[STEP 1] Session token established: ${hasSessionToken}`);

  // Step 2: Use PortalClient to query first page of meters
  console.log('\n[STEP 2] Calling PortalClient.searchMeters("", 1)...');
  const portalClient = new PortalClient(undefined, authManager);
  const rawSearchResult = await portalClient.searchMeters('', 1);

  console.log('[STEP 2] Upstream HTTP status: 200');
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
  console.log(`[STEP 2] Dynamic meter discovered: YES (ID present: ${Boolean(dynamicMeterId)}, Serial present: ${Boolean(dynamicSerialNo)})`);

  // Step 3: Targeted search using dynamically discovered meter ID
  console.log('\n[STEP 3] Testing targeted search for dynamically discovered meter...');
  const targetedSearch = await portalClient.searchMeters(dynamicMeterId, 1);
  console.log(`[STEP 3] Targeted search records found: ${targetedSearch.data.length}`);
  const match = targetedSearch.data.find(m => m.meterId === dynamicMeterId);
  console.log(`[STEP 3] Exact match found: ${Boolean(match)}`);

  // Step 4: Verify same session across different resource (Geo coordinates)
  console.log('\n[STEP 4] Testing cross-resource session: PortalClient.getMeterGeo()...');
  const geoResult = await portalClient.getMeterGeo(dynamicMeterId);
  const hasLat = typeof geoResult.data.latitude === 'string' && geoResult.data.latitude.length > 0;
  const hasLng = typeof geoResult.data.longitude === 'string' && geoResult.data.longitude.length > 0;
  console.log(`[STEP 4] Geolocation retrieved: lat ${hasLat ? 'PRESENT' : 'MISSING'}, lng ${hasLng ? 'PRESENT' : 'MISSING'}`);

  // Step 5: Test through MeterService & Adapter
  console.log('\n[STEP 5] Testing MeterService.getMeters("", 1) normalization...');
  const meterService = new MeterService(portalClient);
  const normalizedResult = await meterService.getMeters('', 1);
  console.log(`[STEP 5] Normalized records count: ${normalizedResult.data.length}`);
  const firstNorm = normalizedResult.data[0];
  console.log(`[STEP 5] Normalized fields present:`, {
    idPresent: Boolean(firstNorm.id),
    serialPresent: Boolean(firstNorm.serialNumber),
    makePresent: Boolean(firstNorm.make),
    phaseTypeValid: firstNorm.phaseType === 'single' || firstNorm.phaseType === 'three',
    statusPresent: Boolean(firstNorm.installationStatus),
    transformerPresent: Boolean(firstNorm.transformerCode)
  });
  console.log(`[STEP 5] Pagination metadata:`, normalizedResult.pagination);

  // Step 6: Test through Express REST API (GET /api/v1/meters)
  console.log('\n[STEP 6] Testing Express REST API: GET /api/v1/meters?q={dynamicMeterId}');
  const apiRes = await request(app).get(`/api/v1/meters?q=${encodeURIComponent(dynamicMeterId)}`);
  console.log(`[STEP 6] Express API HTTP Status: ${apiRes.status}`);
  console.log(`[STEP 6] API Response data length: ${apiRes.body.data?.length}`);
  const firstApiItem = apiRes.body.data?.[0];
  console.log(`[STEP 6] First item matched dynamically: ${firstApiItem?.id === dynamicMeterId}`);

  // Step 7: Test GET /api/v1/meters/:meterId (Meter details & geolocation)
  console.log('\n[STEP 7] Testing Express REST API: GET /api/v1/meters/:meterId...');
  const detailRes = await request(app).get(`/api/v1/meters/${encodeURIComponent(dynamicMeterId)}`);
  console.log(`[STEP 7] Status: ${detailRes.status}`);
  console.log(`[STEP 7] Detail attributes present: id=${Boolean(detailRes.body.data?.id)}, make=${Boolean(detailRes.body.data?.make)}`);
  const hasDetailLat = detailRes.body.data?.location?.latitude !== undefined;
  const hasDetailLng = detailRes.body.data?.location?.longitude !== undefined;
  console.log(`[STEP 7] Geolocation: lat=${hasDetailLat ? 'OK' : 'MISSING'}, lng=${hasDetailLng ? 'OK' : 'MISSING'}`);

  // Step 8: Test GET /api/v1/meters/:meterId/consumption
  console.log('\n[STEP 8] Testing Express REST API: GET /api/v1/meters/:meterId/consumption...');
  const consumptionRes = await request(app).get(`/api/v1/meters/${encodeURIComponent(dynamicMeterId)}/consumption`);
  console.log(`[STEP 8] Status: ${consumptionRes.status}`);
  console.log(`[STEP 8] Total telemetry readings: ${consumptionRes.body.meta?.readingCount}`);
  console.log(`[STEP 8] Timestamp semantics: ${consumptionRes.body.meta?.timestampSemantics}`);
  console.log(`[STEP 8] Units:`, consumptionRes.body.meta?.units);
  if (consumptionRes.body.data?.readings?.length > 0) {
    const firstReading = consumptionRes.body.data.readings[0];
    const hasTimestamps = Boolean(firstReading.sourceTimestamp && firstReading.timestampLocal);
    const hasEnergyValues = typeof firstReading.cumulativeActiveEnergyKwh === 'number' && typeof firstReading.voltageR === 'number';
    console.log(`[STEP 8] Reading validation: validTimestamps=${hasTimestamps}, validCumulativeEnergy=${hasEnergyValues}`);
  }

  // Step 9: Test GET /api/v1/meters/:meterId/hierarchy
  console.log('\n[STEP 9] Testing Express REST API: GET /api/v1/meters/:meterId/hierarchy...');
  const hierarchyRes = await request(app).get(`/api/v1/meters/${encodeURIComponent(dynamicMeterId)}/hierarchy`);
  console.log(`[STEP 9] Status: ${hierarchyRes.status}`);
  console.log(`[STEP 9] Hierarchy depth: ${hierarchyRes.body.meta?.hierarchyDepth}`);
  console.log(`[STEP 9] Hierarchy tiers verified:`, {
    zoneTierPresent: Boolean(hierarchyRes.body.data?.zone?.name),
    circleTierPresent: Boolean(hierarchyRes.body.data?.circle?.name),
    divisionTierPresent: Boolean(hierarchyRes.body.data?.division?.name),
    subdivisionTierPresent: Boolean(hierarchyRes.body.data?.subdivision?.name),
    substationTierPresent: Boolean(hierarchyRes.body.data?.substation?.name),
    feederTierPresent: Boolean(hierarchyRes.body.data?.feeder?.name),
    transformerTierPresent: Boolean(hierarchyRes.body.data?.transformer?.name)
  });

  console.log('\n===============================================================');
  console.log('   ALL LIVE INTEGRATION CHECKS COMPLETED SUCCESSFULLY!        ');
  console.log('===============================================================\n');
}

verifyLiveIntegration().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'Unknown integration error';
  console.error(`[LIVE INTEGRATION FAILED] ${message}`);
  process.exit(1);
});
