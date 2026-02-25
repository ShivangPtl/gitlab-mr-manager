const Groq = require("groq-sdk");

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY  // or hardcode temporarily for testing
});

async function generateMultiMRDescription(data) {

  const prompt = `
Generate SHORT Merge Request Description for each project.

Rules:
- Max 5 lines
- Mention what changed
- Mention area impacted
- Mention Risk: Low/Medium/High
- Mention Test suggestion
- No markdown

Return ONLY valid JSON, nothing else:
{
  "ProjectName": "Short MR Description"
}

Projects:
${data.multiProjectInput}
`;

  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",  // free, very capable model on Groq
    messages: [
      { role: "system", content: "You generate enterprise MR documentation. Always respond in valid JSON only." },
      { role: "user", content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 1000,
    response_format: { type: "json_object" }  // enforces JSON output
  });

  return response.choices[0].message.content;
}

async function generateMultiCodeReview(data) {

  const prompt = `
  You are a Senior .NET and Angular Code Reviewer.
  
  Analyze the following git diff snippets from multiple enterprise repositories.
  
  Perform a BASIC to MEDIUM level pre-merge review based ONLY on the provided changes.
  
  Detect issues related to:
  
  .NET:
  - Hardcoded values (timeouts, thread counts, URLs, secrets)
  - Logging inside service layer
  - Configuration risks (thread pool, connection strings)
  - Memory or performance impacting config changes
  - Exception handling changes
  - Async usage mistakes
  - Possible null dereference risk
  
  Angular:
  - Console logging in production code
  - Direct DOM manipulation
  - Change detection risk
  - API URL hardcoding
  - Subscription without unsubscribe
  - Large component logic change
  - Environment config misuse
  
  General:
  - Performance risk
  - Security risk
  - Configuration risk
  - Maintainability issue
  
  For EACH project:
  
  Return:
  - file → affected file name
  - line → exact added or removed line from diff
  - comment → short reviewer-style suggestion
  - risk → Low | Medium | High
  
  Rules:
  - Ignore formatting or naming suggestions
  - Ignore comments
  - Review only + or - lines
  - Max 3 findings per project
  - Comment must be 1 line only
  - Do NOT explain reasoning
  - Do NOT use markdown
  - Do NOT add extra text
  
  Return ONLY valid JSON array like:
  
  [
   {
    "project":"ProjectName",
    "file":"fileName",
    "line":"+ some changed line",
    "comment":"Short risk based suggestion",
    "risk":"Low"
   }
  ]
  
  Projects:
  ${data.reviewInput}
  `;

  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "You are a strict enterprise code reviewer. Respond in valid JSON array only." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 1000,
    response_format: { type: "json_object" }
  });

  return response.choices[0].message.content;
}


async function generateMRReview(data) {

  const prompt = `
You are a Senior .NET and Angular Code Reviewer.

You will receive git diff snippets grouped by:

Project:<name>
File:<file_path>
Diff:
+ added line
- removed line

Analyze ONLY + or - lines.

Detect:

.NET:
- SQL injection risk
- Null reference risk
- Improper async usage
- Exception handling issues
- Performance impacting query logic
- Logging inside service layer

Angular:
- Direct DOM usage
- Console logging
- Subscription without unsubscribe
- Environment misuse

General:
- Security risk
- Performance risk
- Maintainability issue

DO NOT:
- Suggest config values for appsettings.json
- Suggest naming convention
- Suggest formatting
- Review comments

Return MAX 3 findings per file.

Each finding MUST contain:
project → from Project:
file → from File:
line → exact + or - line
comment → 1 line suggestion
risk → Low | Medium | High

Return ONLY valid JSON object using this EXACT schema:

{
 "findings":[
   {
    "project":"<Project from input>",
    "file":"<File from input>",
    "line":"<exact + or - line>",
    "comment":"<short reviewer suggestion>",
    "risk":"Low | Medium | High"
   }
 ]
}

Rules:
- DO NOT change key names
- DO NOT return array directly
- DO NOT wrap inside any other key
- DO NOT add explanation
- DO NOT add markdown
- If no issue found return:

{
 "findings":[]
}

Input:
${data.reviewInput}
`;

  const response =
    await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "Strict enterprise code reviewer. Respond JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: "json_object" }
    });

  return response.choices[0].message.content;
}

module.exports = { generateMultiMRDescription, generateMultiCodeReview, generateMRReview };