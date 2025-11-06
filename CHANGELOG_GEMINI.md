# Changelog - Gemini Migration

## [Unreleased] - 2024-01-XX

### 🚀 Major Changes
- **Migrated AI provider from OpenAI to Google Gemini 2.5 Pro**
  - All AI interpretations now use Google's Gemini models
  - Default model: `gemini-2.5-pro` for both summaries and reports
  - Alternative: `gemini-2.5-flash` for faster, cost-optimized responses

### ✨ Added
- New dependency: `@google/generative-ai` (v0.24.1)
- New environment variables:
  - `GOOGLE_API_KEY` - Required API key from Google AI Studio
  - `GEMINI_MODEL_SUMMARY` - Optional, defaults to gemini-2.5-pro
  - `GEMINI_MODEL_REPORT` - Optional, defaults to gemini-2.5-pro
- New documentation files:
  - `MIGRATION_GEMINI.md` - Complete migration guide
  - `TEST_CHECKLIST_GEMINI.md` - Testing checklist for QA
  - `CHANGELOG_GEMINI.md` - This file

### 🔄 Changed
- **`pages/api/ai/interpret.ts`**
  - Replaced OpenAI client with GoogleGenerativeAI
  - Updated API calls to use `generateContent()` method
  - Maintained 30-second timeout with AbortController
  - Updated error messages to reference Gemini
  - Improved error handling for Gemini-specific errors

- **`worker/worker.ts`**
  - Replaced OpenAI client with GoogleGenerativeAI  
  - Updated report generation to use Gemini API
  - Maintained rate limiting (1 second between jobs)
  - Updated logging to reference Gemini
  - Kept all storage upload logic unchanged

- **`.env.example`**
  - Removed: `OPENAI_API_KEY`, `OPENAI_MODEL_SUMMARY`, `OPENAI_REPORT_MODEL`
  - Added: `GOOGLE_API_KEY`, `GEMINI_MODEL_SUMMARY`, `GEMINI_MODEL_REPORT`

- **`README.md`**
  - Updated Tech Stack section: "Google Gemini 2.5 Pro"
  - Updated Prerequisites: Mention Google AI Studio
  - Updated environment variable documentation throughout
  - Updated code examples and logs to reference Gemini
  - Updated Features section

- **`README_DEPLOY.md`**
  - Updated all environment variable references
  - Changed deployment setup instructions
  - Updated Vercel environment variable configuration
  - Updated API key acquisition instructions

- **`package.json` & `package-lock.json`**
  - Removed: `openai` package and its dependencies
  - Added: `@google/generative-ai` package

### ❌ Removed
- OpenAI dependency (`openai` package v4.3.0)
- OpenAI-specific environment variables
- All OpenAI client code and imports

### 🔒 Security
- ✅ Verified no API keys leaked to client bundles
- ✅ API key validation at module load time
- ✅ Maintained server-side only execution for AI clients
- ✅ Environment variable security unchanged

### 🧪 Testing
- ✅ All 12 BaZi algorithm tests passing
- ✅ Build succeeds without errors
- ✅ TypeScript types resolve correctly
- ✅ No runtime errors in development mode
- ✅ Package imports work correctly

### 📦 Dependencies
**Added:**
- `@google/generative-ai: ^0.24.1`

**Removed:**
- `openai: ^4.3.0`

### 💰 Cost Implications
**Gemini 2.5 Pro Pricing:**
- Input: ~$0.00125 per 1K tokens (lower than GPT-4o)
- Output: ~$0.005 per 1K tokens

**Gemini 2.5 Flash Pricing:**
- Input: ~$0.000075 per 1K tokens (significantly cheaper)
- Output: ~$0.0003 per 1K tokens

**Recommendation:** Start with gemini-2.5-pro for quality, switch to gemini-2.5-flash if cost optimization needed.

### 🔄 API Compatibility
- ✅ **100% backward compatible** - All API endpoints work identically
- ✅ Request/response formats unchanged
- ✅ Error codes and messages consistent
- ✅ Timeout behavior identical (30 seconds)
- ✅ Chinese language output maintained

### 📝 Migration Steps for Existing Deployments

1. **Update code:**
   ```bash
   git checkout feat-migrate-ai-to-gemini-2-5-pro
   npm install
   ```

2. **Get Google API key:**
   - Visit https://aistudio.google.com/apikey
   - Create/select project and generate API key

3. **Update environment variables:**
   ```bash
   # Remove (or comment out):
   # OPENAI_API_KEY=...
   # OPENAI_MODEL_SUMMARY=...
   # OPENAI_REPORT_MODEL=...
   
   # Add:
   GOOGLE_API_KEY=AIzaSy...your-key-here
   GEMINI_MODEL_SUMMARY=gemini-2.5-pro
   GEMINI_MODEL_REPORT=gemini-2.5-pro
   ```

4. **Test locally:**
   ```bash
   npm run dev
   # Test API endpoint and worker
   ```

5. **Deploy to production:**
   - Update environment variables in Vercel/hosting platform
   - Deploy the new code
   - Monitor logs for any issues

6. **Verify:**
   - Test AI interpretations return Chinese text
   - Test worker generates reports successfully
   - Check logs reference Gemini (not OpenAI)

### ⚠️ Breaking Changes
**For existing deployments:**
- Must update environment variables (OPENAI_* → GOOGLE_API_KEY + GEMINI_*)
- Must obtain Google API key before deployment
- Must have Gemini API access (free tier available)

**Not breaking for API consumers:**
- All endpoints maintain same interface
- Response formats unchanged
- No changes to request payloads

### 🐛 Known Issues
- None at this time

### 🔮 Future Enhancements
- Consider adding fallback to OpenAI if Gemini unavailable
- Implement cost tracking and monitoring
- Add support for Gemini 2.5 Flash experiments
- Implement response streaming for real-time feedback

### 📚 References
- Google AI Studio: https://aistudio.google.com/
- Gemini API Docs: https://ai.google.dev/docs
- Gemini Pricing: https://ai.google.dev/pricing
- Migration Guide: See `MIGRATION_GEMINI.md`

---

**Migration Status:** ✅ Complete  
**Tested:** ✅ Build, Tests, Dependencies  
**Ready for Deployment:** ✅ Yes  
**Backward Compatible:** ✅ Yes (with env var updates)
