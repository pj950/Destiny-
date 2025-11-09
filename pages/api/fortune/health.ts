import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: {
    database: {
      status: 'pass' | 'fail' | 'warn'
      message: string
      details?: any
    }
    googleAI: {
      status: 'pass' | 'fail' | 'warn'
      message: string
      details?: any
    }
    environment: {
      status: 'pass' | 'fail' | 'warn'
      message: string
      missing: string[]
      configured: string[]
    }
  }
  recommendations: string[]
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        status: 'pass',
        message: 'Database connection successful'
      },
      googleAI: {
        status: 'pass', 
        message: 'Google AI connection successful'
      },
      environment: {
        status: 'pass',
        message: 'All environment variables configured',
        missing: [],
        configured: []
      }
    },
    recommendations: []
  }

  // Check environment variables
  const requiredEnvVars = [
    'GOOGLE_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_MODEL_SUMMARY',
    'GEMINI_MODEL_REPORT'
  ]

  const missingVars: string[] = []
  const configuredVars: string[] = []
  const placeholderVars: string[] = []

  requiredEnvVars.forEach(varName => {
    const value = process.env[varName]
    if (!value) {
      missingVars.push(varName)
    } else if (value.includes('your-') || value.includes('test') || value === 'test-google-api-key') {
      placeholderVars.push(varName)
    } else {
      configuredVars.push(varName)
    }
  })

  if (missingVars.length > 0 || placeholderVars.length > 0) {
    result.checks.environment.status = 'fail'
    result.checks.environment.message = `Environment variables not properly configured`
    result.checks.environment.missing = missingVars
    result.checks.environment.configured = configuredVars
    
    result.recommendations.push(
      'Configure missing environment variables in .env.local',
      'Replace placeholder values with real credentials',
      'Ensure Google API key has Gemini API access'
    )
  } else {
    result.checks.environment.configured = configuredVars
  }

  // Test database connection
  try {
    const { data, error } = await supabaseService
      .from('fortunes')
      .select('count')
      .limit(1)
      .maybeSingle()

    if (error) {
      result.checks.database.status = 'fail'
      result.checks.database.message = 'Database connection failed'
      result.checks.database.details = {
        error: error.message,
        code: error.code,
        hint: error.hint
      }
      
      if (error.code === 'PGRST116') {
        result.recommendations.push(
          'Run database migrations: CREATE TABLE fortunes',
          'Check RLS policies: ALTER TABLE fortunes ENABLE ROW LEVEL SECURITY'
        )
      } else if (error.message.includes('fetch failed')) {
        result.recommendations.push(
          'Verify Supabase URL is correct',
          'Check Supabase service role key',
          'Ensure Supabase project is active'
        )
      } else {
        result.recommendations.push(
          'Check database permissions',
          'Verify RLS policies allow anonymous access'
        )
      }
    }
  } catch (dbError: any) {
    result.checks.database.status = 'fail'
    result.checks.database.message = 'Database test failed'
    result.checks.database.details = { error: dbError.message }
    result.recommendations.push('Check Supabase configuration and connectivity')
  }

  // Test Google AI connection
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey || placeholderVars.includes('GOOGLE_API_KEY')) {
      result.checks.googleAI.status = 'fail'
      result.checks.googleAI.message = 'Google API key not configured or using placeholder'
      result.recommendations.push(
        'Add valid GOOGLE_API_KEY to environment variables',
        'Ensure API key has Gemini API access'
      )
    } else {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ 
        model: process.env.GEMINI_MODEL_SUMMARY || 'gemini-2.5-pro' 
      })
      
      // Test with a simple prompt (with timeout)
      const testResult = await Promise.race([
        model.generateContent('Test connection'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        )
      ]) as any

      if (testResult?.response?.text) {
        result.checks.googleAI.message = 'Google AI connection successful'
      } else {
        result.checks.googleAI.status = 'warn'
        result.checks.googleAI.message = 'Google AI connected but unexpected response'
      }
    }
  } catch (aiError: any) {
    result.checks.googleAI.status = 'fail'
    result.checks.googleAI.message = 'Google AI connection failed'
    result.checks.googleAI.details = { error: aiError.message }
    
    if (aiError.message.includes('API_KEY')) {
      result.recommendations.push(
        'Google API key is invalid or expired',
        'Check Google Cloud Console for API key status'
      )
    } else if (aiError.message.includes('permission') || aiError.message.includes('forbidden')) {
      result.recommendations.push(
        'Enable Gemini API in Google Cloud Console',
        'Check API key permissions for Gemini API'
      )
    } else if (aiError.message.includes('timeout')) {
      result.recommendations.push(
        'Check network connectivity to Google AI services',
        'Consider increasing timeout for AI responses'
      )
    }
  }

  // Determine overall status
  const failedChecks = Object.values(result.checks).filter(check => check.status === 'fail')
  const warnChecks = Object.values(result.checks).filter(check => check.status === 'warn')
  
  if (failedChecks.length > 0) {
    result.status = 'unhealthy'
  } else if (warnChecks.length > 0) {
    result.status = 'degraded'
  }

  // Add general recommendations if needed
  if (result.recommendations.length === 0) {
    result.recommendations.push('All systems operational - Daily Fortune feature should work correctly')
  }

  const statusCode = result.status === 'healthy' ? 200 : 
                    result.status === 'degraded' ? 200 : 503

  return res.status(statusCode).json(result)
}
