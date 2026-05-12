@echo off
git add -A
git status --short
git commit -m "feat: hierarchy + permission architecture, Arena team-based grouping, org management

- Add centralized permission system (lib/permissions.ts) with 35 named permissions
- Add HierarchyRole model for configurable authority levels (Manager, Team Lead, etc.)
- Add Team and Department models with full CRUD APIs
- Add hierarchy assignment API with jobTitle, managerId, teamId support
- Add reporting chain API and team-view API
- Refactor Arena Management: KPIs/sprints now owned by teamName not playbookRole
- Remove all KPI Function Group / Playbook Role terminology from Arena UI
- Arena monitoring groups employees by team, not by role
- Employee cards show team name as primary label, hierarchy role as badge
- Add Organization tab to admin settings for team/department management
- Add AssignModal with team + department dropdowns (no free-text)
- Fix employee list visibility (Mongoose enum bug on systemRole field)
- Fix work-hour calculation (break subtraction, avgWorkMins denominator)
- Fix /api/org StrictPopulateError with hierarchyRoleId fallback
- Add .env.example (no secrets committed)"
git remote set-url origin https://github.com/Hiteshbhartia/attendance-feature-test.git
git push -u origin feature/hierarchy-arena-refactor
