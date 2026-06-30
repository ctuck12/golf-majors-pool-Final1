@AGENTS.md

# Deployment — do NOT use the Vercel MCP tools

This project deploys automatically through Vercel's Git integration: pushing to
`main` triggers a production build, and pushing any branch triggers a preview
build. You do NOT need the Vercel MCP tools (`deploy_to_vercel`,
`list_deployments`, `get_deployment`, `list_projects`, `list_teams`, etc.) to
deploy — they only read status, and calling them forces the user to approve a
permission popup every session (the MCP server ID rotates, so saved allow-rules
never match). To deploy: commit, push to the target branch, and tell the user it
will deploy via Git integration. Only call a Vercel MCP tool if the user
explicitly asks you to check/verify deployment status.
