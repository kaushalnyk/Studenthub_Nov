# Student Hub

Student administration app built with SAP CAP (Node.js) and a SAPUI5 front end. It manages students, courses and enrollments, and reads Business Partners live from an S/4HANA sandbox.

> **Full walkthrough with diagrams:** open [docs/student-hub-anatomy.html](docs/student-hub-anatomy.html) in a browser. It explains how the front end reaches the back end, the request flow, data model, roles and deployment. The diagrams use Mermaid and need internet access to load the fonts and renderer.

## Architecture

```
Browser (UI5) --> App Router (xs-app.json) --> CAP server --> SQLite (dev) / SAP HANA (prod)
                                                    |
                                                    +--> S/4HANA sandbox (API_BUSINESS_PARTNER)
```

| Folder / file | Purpose |
|---|---|
| `app/studenthub/` | UI5 app: `manifest.json`, `view/*.xml`, `controller/*.js`, `css/`, `i18n/` |
| `app/router/` | App Router config (`xs-app.json`) |
| `db/schema.cds`, `db/data/*.csv` | Entities (Student, Course, Enrollments) and seed data |
| `srv/student-service.cds/.js` | `StudentService` at `/odata/v4/student/` |
| `srv/s4-service.cds/.js` | `DavidS4Service` at `/odata/v4/david-s4/` (proxies S/4HANA) |
| `srv/external/` | Imported S/4 API definition |
| `mta.yaml`, `xs-security.json` | Cloud Foundry deployment and roles |
| `docs/` | Documentation (architecture walkthrough) |
| `test.http` | Sample API requests |

## Run locally

```bash
npm install
npx cds watch
```

Open <http://localhost:4004/studenthub/index.html> and sign in with a mocked user:

| User | Password | Role |
|---|---|---|
| Nagarjuna | Nagarjuna | Admin |
| Kaushal | Kaushal | Manager |
| Venkat | Venkat | User |
| David | David | User |

## Features

- **Students:** search, filter by department, create, edit, delete, suspend/activate, graduate, change department, enroll in or drop courses, view enrolled courses, average credits, total count, list by department.
- **Courses:** read-only course list.
- **Business Partners:** list and search S/4HANA partners, filter by category, latest N, lookup by UUID, details, name and existence check.

## How the UI calls the back end

- Table reads and filters use the OData V4 model, for example `GET /odata/v4/student/Students?$filter=...`.
- Actions use `fetch` with a CSRF token, for example `POST /odata/v4/student/Students(ID='...')/StudentService.suspendStudent`.
- Hash routes (`#/`, `#/courses`, `#/business-partners`) switch pages without a server call.

## Roles

- `User`: read, average credits.
- `Manager`: also graduate students.
- `Admin`: full access, including delete.

## Build and deploy

```bash
mbt build
cf deploy mta_archives/Studenthub_Nov_1.0.0.mtar
```

`mta.yaml` compiles CAP and copies `app/studenthub` into `.deploy/app-router/resources/studenthub`. Edit files under `app/studenthub` only.

## Known issues

- The S/4 sandbox API key is stored in `package.json`. Move it to an environment variable or a git-ignored file and rotate it.
- `Student.Name` is limited to 20 characters.
- `Manager` has no grant on the `Students` entity in `@restrict`, so graduating as a Manager should be tested.
- The UI shows all buttons to every role. The server enforces permissions.

## Learn more

<https://cap.cloud.sap>
