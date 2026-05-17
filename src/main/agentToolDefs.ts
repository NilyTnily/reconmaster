import type { ToolDef } from './providers/index'

export type ToolTier = 'silent' | 'show' | 'approve' | 'confirm'

export interface ToolMeta extends ToolDef {
  tier: ToolTier
  label: string
}

export const AGENT_TOOLS: ToolMeta[] = [
  // ── Intelligence ──────────────────────────────────────────────────────────
  {
    name: 'analyze_and_plan', label: 'Analyze & Plan Attack', tier: 'silent',
    description: 'Analyze ALL current scan data and produce a structured, prioritized attack plan. Call this first before any other action. Returns: critical findings, login pages, discovered secrets/emails, high-risk ports, and a step-by-step exploitation sequence tailored to what was found.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'fetch_url', label: 'Fetch URL', tier: 'silent',
    description: 'Fetch any URL and return clean text content. Use to look up CVE details on nvd.nist.gov, PoC exploits on exploit-db.com, GitHub advisories, vendor bulletins, API docs, or any web resource. Fast raw HTTP — not the browser.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch (http or https)' },
        max_chars: { type: 'number', description: 'Max characters to return (default 8000, max 20000)' },
      },
      required: ['url'],
    },
  },
  // ── Scan data ──────────────────────────────────────────────────────────────
  {
    name: 'read_scan', label: 'Read Scan Data', tier: 'silent',
    description: 'Read a section of the current scan results. Sections: summary, dns, subdomains, ports, http, ssl, dirs, vulns, osint, js, all.',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string', enum: ['summary', 'dns', 'subdomains', 'ports', 'http', 'ssl', 'dirs', 'vulns', 'osint', 'js', 'all'] },
      },
      required: ['section'],
    },
  },
  // ── Memory ─────────────────────────────────────────────────────────────────
  {
    name: 'save_memory', label: 'Save Memory', tier: 'silent',
    description: 'Persist a key-value fact to long-term memory. Survives across chat sessions. Use for credentials found, confirmed vulnerabilities, session tokens, user IDs, API keys.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Short identifier, e.g. "admin_password"' },
        value: { type: 'string', description: 'Value to remember' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'read_memory', label: 'Read Memory', tier: 'silent',
    description: 'Read all persisted memory for this scan.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  // ── Browser ────────────────────────────────────────────────────────────────
  {
    name: 'browser_navigate', label: 'Navigate & Read Page', tier: 'show',
    description: 'Navigate to a URL and immediately return the full page: title, URL, all visible text, all links, all forms with their fields, cookies, any JWT tokens found, and API endpoints in the source. You do NOT need to call a separate read tool — everything is returned here.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        wait_ms: { type: 'number', description: 'Extra ms to wait after load (default 1500 for JS-heavy SPAs)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'browser_click', label: 'Click & Read Result', tier: 'approve',
    description: 'Click an element on the page (by CSS selector or visible text) then return the updated DOM — links, forms, and page text after the click. Useful for navigating menus, submitting forms via button, and observing redirects.',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or visible text string' },
        by_text: { type: 'boolean', description: 'If true, match by visible text instead of CSS' },
        wait_ms: { type: 'number', description: 'Ms to wait after click for page to settle (default 800)' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'browser_fill', label: 'Fill Input Field', tier: 'approve',
    description: 'Type a value into a specific form input field identified by CSS selector.',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        value: { type: 'string' },
        clear_first: { type: 'boolean', description: 'Clear existing content first (default true)' },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'browser_fill_form', label: 'Auto-Fill & Submit Form', tier: 'approve',
    description: 'Detect all form fields on the page, fill with realistic generated data appropriate to field type, and optionally submit. Intelligently detects form purpose (login/register/search/contact) to choose appropriate values. Can inject discovered credentials from scan data.',
    parameters: {
      type: 'object',
      properties: {
        submit: { type: 'boolean', description: 'Submit the form after filling (default false)' },
        form_selector: { type: 'string', description: 'CSS selector for specific form (default: first form)' },
        username_value: { type: 'string', description: 'Specific username/email to use (e.g. from OSINT emails)' },
        password_value: { type: 'string', description: 'Specific password to try (e.g. discovered credential)' },
      },
      required: [],
    },
  },
  {
    name: 'browser_execute_js', label: 'Execute JavaScript', tier: 'approve',
    description: 'Execute JavaScript in the page context and return the result. Use to: decode JWT tokens (atob), extract localStorage/sessionStorage, read cookies, test XSS payloads, extract hidden data, or manipulate the DOM.',
    parameters: {
      type: 'object',
      properties: { code: { type: 'string', description: 'JavaScript to execute. Use return to get a value.' } },
      required: ['code'],
    },
  },
  {
    name: 'browser_audit_page', label: 'Audit Page Security', tier: 'show',
    description: 'Deep security audit of the current page. Returns: all input fields (XSS vectors), CSRF protection status, hidden inputs with values (IDOR vectors), JWT tokens, API endpoints found in source, unprotected forms, auth indicators, and any sensitive data visible on the page.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  // ── Testing ───────────────────────────────────────────────────────────────
  {
    name: 'test_endpoint', label: 'Test Endpoint for Vulns', tier: 'approve',
    description: 'Test a specific URL parameter for vulnerabilities. Sends crafted payloads and analyzes responses for vulnerability indicators. Detects: XSS (reflection), SQLi (error-based), SSTI (math evaluation), LFI (path traversal), open redirect. Returns confirmed findings with evidence.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target URL (base URL without the test payload)' },
        parameter: { type: 'string', description: 'Query parameter name to inject into' },
        vulnerability_type: {
          type: 'string',
          enum: ['xss', 'sqli', 'ssti', 'lfi', 'open_redirect', 'all'],
          description: 'Type of vulnerability to test (default: all)',
        },
      },
      required: ['url', 'parameter'],
    },
  },
  // ── Exploitation ──────────────────────────────────────────────────────────
  {
    name: 'run_nuclei', label: 'Run Nuclei Scan', tier: 'approve',
    description: 'Run nuclei vulnerability scanner against a target with specified templates and severity filters. Returns structured findings table.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target URL or host' },
        templates: {
          type: 'array',
          items: { type: 'string' },
          description: 'Template IDs or tags, e.g. ["http/cves","http/exposures","xss"]. Defaults to http/cves,http/exposures.',
        },
        severity: {
          type: 'array',
          items: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          description: 'Filter by severity. Leave empty for all.',
        },
        rate_limit: { type: 'number', description: 'Requests per second (default 150)' },
        timeout_ms: { type: 'number', description: 'Total timeout in ms (default 120000)' },
      },
      required: ['target'],
    },
  },
  {
    name: 'propose_chain', label: 'Propose Attack Chain', tier: 'approve',
    description: 'Propose a named multi-step attack chain to the user. Describe each planned step. When approved, all steps execute without individual prompts. Always use this before executing 3+ sequential browser/command actions.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Name for this attack chain' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tool: { type: 'string', description: 'Tool name that will be called' },
              description: { type: 'string', description: 'What this step does and why' },
            },
            required: ['tool', 'description'],
          },
        },
      },
      required: ['title', 'steps'],
    },
  },
  {
    name: 'run_command', label: 'Run Command', tier: 'confirm',
    description: 'Execute a terminal command silently. Use for quick checks, curl tests, service enumeration. Output is returned to the chat only.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to execute' },
        description: { type: 'string', description: 'Human-readable description of what this does' },
        timeout_ms: { type: 'number', description: 'Timeout in ms (default 30000)' },
      },
      required: ['command', 'description'],
    },
  },
  // ── Terminal integration ───────────────────────────────────────────────────
  {
    name: 'run_in_terminal', label: 'Run in Terminal', tier: 'approve',
    description: 'Run a command in the visible AI Shell terminal tab so the user can watch the output in real-time. Prefer this over run_command for exploit commands, long-running tools, and anything the user should see.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to execute' },
        description: { type: 'string', description: 'What this command does' },
        timeout_ms: { type: 'number', description: 'Timeout in ms (default 60000)' },
      },
      required: ['command', 'description'],
    },
  },
  // ── Weapons & config ───────────────────────────────────────────────────────
  {
    name: 'get_weapons', label: 'Get Weapon List', tier: 'silent',
    description: 'Get the full list of identified weapons/exploits for this scan including categories, severity, and confidence scores.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_attacker_config', label: 'Get Attacker Config', tier: 'silent',
    description: 'Get the current attacker configuration (LHOST, LPORT, C2 domain, Interactsh URL, etc.).',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'set_attacker_config', label: 'Set Attacker Config', tier: 'approve',
    description: 'Update attacker configuration values. Only specify fields you want to change.',
    parameters: {
      type: 'object',
      properties: {
        lhost: { type: 'string', description: 'Attacker IP / listener host' },
        lport: { type: 'string', description: 'Listener port (default 4444)' },
        c2domain: { type: 'string', description: 'C2 callback domain' },
        interactshUrl: { type: 'string', description: 'Interactsh OOB URL' },
        sessionCookie: { type: 'string', description: 'Session cookie for authenticated testing' },
      },
      required: [],
    },
  },
  {
    name: 'set_weapon_status', label: 'Update Weapon Status', tier: 'approve',
    description: 'Update the exploitation status of a weapon. Use to mark confirmed vulnerabilities, not-vulnerable results, or reported findings.',
    parameters: {
      type: 'object',
      properties: {
        weapon_id: { type: 'string', description: 'Weapon ID from get_weapons' },
        status: { type: 'string', enum: ['untested', 'testing', 'confirmed', 'not-vulnerable', 'reported'] },
        note: { type: 'string', description: 'Optional note about the finding' },
      },
      required: ['weapon_id', 'status'],
    },
  },
  {
    name: 'list_installed_tools', label: 'List Installed Tools', tier: 'silent',
    description: 'List all available security tools and whether they are installed and enabled.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  // ── Scan control ──────────────────────────────────────────────────────────────
  {
    name: 'start_scan', label: 'Start New Scan', tier: 'confirm',
    description: 'Start a new recon scan against a target. Runs all scan phases (DNS, subdomains, ports, HTTP, vulns, etc.). The scan appears as a new tab in the UI.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target domain or IP (e.g. example.com)' },
        options: { type: 'object', description: 'Scan phase toggles, e.g. { dns: true, ports: true, vulns: true }' },
      },
      required: ['target'],
    },
  },
  {
    name: 'cancel_scan', label: 'Cancel Scan', tier: 'confirm',
    description: 'Cancel a running scan by its scan ID.',
    parameters: {
      type: 'object',
      properties: {
        scan_id: { type: 'string', description: 'Scan ID to cancel' },
      },
      required: ['scan_id'],
    },
  },
  {
    name: 'export_report', label: 'Export Report', tier: 'silent',
    description: 'Export the current scan results to a file in the exports folder. Returns the file path.',
    parameters: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['json', 'markdown'], description: 'Export format (default: markdown)' },
      },
      required: [],
    },
  },
  // ── File I/O ──────────────────────────────────────────────────────────────────
  {
    name: 'read_file', label: 'Read File', tier: 'approve',
    description: 'Read a file from the agent output directory and return its contents. Provide a filename or relative subpath (e.g. "payload.txt"). Reads are restricted to the agent-output folder.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Filename inside agent-output folder (e.g. "payload.txt", "wordlists/idor.txt")' },
        max_chars: { type: 'number', description: 'Max characters to return (default 10000)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'save_file', label: 'Save File', tier: 'approve',
    description: 'Write content to a file inside the agent output directory. Use to save payloads, custom wordlists, scripts, or notes. Provide a filename only (e.g. "payload.txt") — the file is always written to the secure agent-output folder.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Filename (e.g. "payload.txt"). Subdirectories inside agent-output are allowed (e.g. "wordlists/idor.txt").' },
        content: { type: 'string', description: 'Content to write' },
        append: { type: 'boolean', description: 'Append instead of overwrite (default false)' },
      },
      required: ['path', 'content'],
    },
  },
]
