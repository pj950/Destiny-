#!/usr/bin/env node

// Diagnostic script for Daily Fortune AI functionality
const fs = require('fs');
const path = require('path');

console.log('🔍 Daily Fortune AI Diagnosis Report');
console.log('=====================================\n');

// 1. Check environment variables
console.log('1. Environment Variables Check:');
console.log('-------------------------------');

const envFiles = ['.env.local', '.env', '.env.example'];
let envVars = {};

for (const envFile of envFiles) {
  const envPath = path.join(__dirname, envFile);
  if (fs.existsSync(envPath)) {
    console.log(`✅ Found ${envFile}`);
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    lines.forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match && !line.startsWith('#')) {
        envVars[match[1]] = match[2];
      }
    });
  } else {
    console.log(`❌ Missing ${envFile}`);
  }
}

const requiredVars = [
  'GOOGLE_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL', 
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_MODEL_SUMMARY',
  'GEMINI_MODEL_REPORT'
];

let missingVars = [];
let configuredVars = [];

requiredVars.forEach(varName => {
  if (envVars[varName]) {
    if (envVars[varName].includes('test') || envVars[varName].includes('your-')) {
      console.log(`⚠️  ${varName}: Using placeholder value`);
      missingVars.push(varName);
    } else {
      console.log(`✅ ${varName}: Configured`);
      configuredVars.push(varName);
    }
  } else {
    console.log(`❌ ${varName}: Missing`);
    missingVars.push(varName);
  }
});

// 2. Check API endpoint file
console.log('\n2. API Endpoint Check:');
console.log('----------------------');

const apiPath = path.join(__dirname, 'pages/api/fortune/draw.ts');
if (fs.existsSync(apiPath)) {
  console.log('✅ API endpoint exists: /api/fortune/draw');
  
  const apiContent = fs.readFileSync(apiPath, 'utf8');
  
  // Check for Google AI import
  if (apiContent.includes('@google/generative-ai')) {
    console.log('✅ Google Generative AI import found');
  } else {
    console.log('❌ Google Generative AI import missing');
  }
  
  // Check for error handling
  if (apiContent.includes('AI解签暂时不可用')) {
    console.log('✅ AI unavailable message found');
  } else {
    console.log('❌ AI unavailable message missing');
  }
  
  // Check for environment validation
  if (apiContent.includes('GOOGLE_API_KEY')) {
    console.log('✅ Google API key validation found');
  } else {
    console.log('❌ Google API key validation missing');
  }
} else {
  console.log('❌ API endpoint missing');
}

// 3. Check database migrations
console.log('\n3. Database Migration Check:');
console.log('---------------------------');

const migrationsPath = path.join(__dirname, 'supabase/migrations');
if (fs.existsSync(migrationsPath)) {
  const migrations = fs.readdirSync(migrationsPath).filter(f => f.endsWith('.sql'));
  
  const fortuneMigrations = migrations.filter(f => 
    f.includes('fortune') || f.includes('20241106000002') || f.includes('20241109000001')
  );
  
  if (fortuneMigrations.length > 0) {
    console.log(`✅ Found ${fortuneMigrations.length} fortune-related migrations:`);
    fortuneMigrations.forEach(m => console.log(`   - ${m}`));
  } else {
    console.log('❌ No fortune-related migrations found');
  }
  
  // Check specific migration content
  const createTablePath = path.join(migrationsPath, '20241106000002_create_fortunes_table.sql');
  if (fs.existsSync(createTablePath)) {
    console.log('✅ Fortunes table creation migration exists');
  } else {
    console.log('❌ Fortunes table creation migration missing');
  }
  
  const rlsPath = path.join(migrationsPath, '20241109000001_enable_fortunes_rls.sql');
  if (fs.existsSync(rlsPath)) {
    console.log('✅ Fortune RLS policies migration exists');
  } else {
    console.log('❌ Fortune RLS policies migration missing');
  }
} else {
  console.log('❌ Migrations directory not found');
}

// 4. Check frontend integration
console.log('\n4. Frontend Integration Check:');
console.log('------------------------------');

const fortunePagePath = path.join(__dirname, 'pages/fortune.tsx');
if (fs.existsSync(fortunePagePath)) {
  console.log('✅ Fortune page exists');
  
  const pageContent = fs.readFileSync(fortunePagePath, 'utf8');
  
  if (pageContent.includes('/api/fortune/draw')) {
    console.log('✅ API call to /api/fortune/draw found');
  } else {
    console.log('❌ API call to /api/fortune/draw missing');
  }
  
  if (pageContent.includes('ai_analysis')) {
    console.log('✅ AI analysis handling found');
  } else {
    console.log('❌ AI analysis handling missing');
  }
} else {
  console.log('❌ Fortune page missing');
}

// 5. Summary and recommendations
console.log('\n5. Diagnosis Summary:');
console.log('--------------------');

if (missingVars.length === 0 && configuredVars.length === requiredVars.length) {
  console.log('✅ All environment variables properly configured');
} else {
  console.log('❌ Environment variables need configuration:');
  missingVars.forEach(v => console.log(`   - ${v}`));
}

console.log('\n📋 Recommended Actions:');
console.log('======================');

if (missingVars.length > 0) {
  console.log('1. Configure missing environment variables:');
  console.log('   - Create a proper .env.local file');
  console.log('   - Add valid Supabase credentials');
  console.log('   - Add valid Google API key');
  console.log('   - Set Gemini model names');
}

console.log('2. Ensure database migrations are run in production');
console.log('3. Test API endpoint with valid credentials');
console.log('4. Verify Google Gemini API access');

console.log('\n🔧 Quick Fix Steps:');
console.log('==================');
console.log('1. Copy .env.example to .env.local');
console.log('2. Replace placeholder values with real credentials');
console.log('3. Run: npm run dev');
console.log('4. Test: curl -X POST http://localhost:3000/api/fortune/draw -H "Content-Type: application/json" -d \'{"category": "事业运"}\'');

console.log('\n✅ Diagnosis complete!');
