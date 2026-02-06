# IssueTracker - Complete Project Management System

IssueTracker is a robust, full-featured backend system designed for team collaboration, software bug tracking, and project management. Built with Node.js and MongoDB, it provides a scalable architecture for organizations to manage multiple projects, teams, and workflows.

---

## 📋 Table of Contents
1. [Introduction](#1-introduction)
2. [Features](#2-features)
3. [Technology Stack](#3-technology-stack)
4. [Installation Guide](#4-installation-guide)
5. [Configuration (.env)](#5-configuration)
6. [Models Documentation](#6-models-documentation)
7. [API Reference](#7-api-reference)
   - [Authentication](#auth-api)
   - [Companies](#company-api)
   - [Projects](#project-api)
   - [Issues](#issue-api)
   - [Dashboard & Reports](#stats-api)
8. [Production Image Storage (Crucial)](#8-production-image-storage)
9. [Error Handling](#9-error-handling)
10. [License](#10-license)

---

## 1. Introduction
IssueTracker serves as the central nervous system for development teams. It allows company-wide organization where administrators can create projects, assign leads, and track the entire lifecycle of software issues—from discovery (bug) to resolution.

---

## 2. Features
- **Company-Based Isolation**: Secure data separation using unique company codes.
- **Role-Based Access Control (RBAC)**: Defined roles (Admin, Manager, Developer, Tester) with varying permissions.
- **Dynamic Issue Lifecycle**: Support for Bugs, Tasks, Stories, and Epics with customizable priorities.
- **Detailed History Tracking**: Every change to an issue is logged (who, when, what changed).
- **Sub-tasks & Comments**: Nested task management and team discussion threads.
- **Statistics Dashboards**: Real-time project progress and team performance metrics.
- **File Management**: Support for attachments and user avatars.

---

## 3. Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Atlas)
- **ORM**: Mongoose
- **Security**: JWT (JSON Web Tokens) & Bcrypt (Password Hashing)
- **File Handling**: Multer
- **Utilities**: node-cron (Cleanup tasks), mongoose-paginate-v2

---

## 4. Installation Guide

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd IssueTracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Database Setup**
   Ensure you have MongoDB installed locally or have a MongoDB Atlas connection string ready.

4. **Run the server**
   ```bash
   # Development mode (requires nodemon)
   npm run dev
   
   # Production mode
   npm start
   ```

---

## 5. Configuration
Create a `.env` file in the root directory with the following variables:

```env
port=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_key
NODE_ENV=development
```

---

## 6. Models Documentation

### 👤 User Model
| Field | Type | Description |
|---|---|---|
| `company_id` | ObjectId | Reference to the Company |
| `name` | String | Full name of the user |
| `email` | String | Unique login email |
| `role` | String | admin, manager, developer, tester |
| `avatar` | String | Path/URL to user profile picture |

### 🏢 Company Model
| Field | Type | Description |
|---|---|---|
| `name` | String | Legal name of the company |
| `email` | String | Primary contact email |
| `company_code` | String | Unique 8-character code for registration |

### 📁 Project Model
| Field | Type | Description |
|---|---|---|
| `name` | String | Project name |
| `key` | String | Short unique key (e.g., "PROJ") |
| `project_lead` | ObjectId | Reference to User (Lead) |
| `team_members` | Array | List of User ObjectIds |
| `status` | String | active, inactive, completed, archived |

### 🐛 Issue Model
| Field | Type | Description |
|---|---|---|
| `project_id` | ObjectId | Parent project |
| `title` | String | Summary of the issue |
| `issue_type` | String | bug, task, story, epic |
| `priority` | String | lowest to critical |
| `status` | String | open, in_progress, resolved, closed |
| `history` | Array | Auto-generated log of all changes |

---

## 7. API Reference

<a name="auth-api"></a>
### 🔐 Authentication (`/auth`)
- `POST /auth/register` - Create new user with `company_code`.
- `POST /auth/login` - Authenticate user and receive JWT.
- `GET /auth/me` - Get current logged-in user details.
- `POST /auth/logout` - Invalidate current session.

<a name="company-api"></a>
### 🏢 Companies (`/companies`)
- `POST /companies` - Create a new company.
- `GET /companies/:id` - Get company details.

<a name="project-api"></a>
### 📁 Projects (`/projects`)
- `GET /projects` - List all projects for user's company (Paginated).
- `POST /projects` - Create new project.
- `GET /projects/:id` - Detailed project view.
- `POST /projects/:id/team` - Add member to project.

<a name="issue-api"></a>
### 🐛 Issues (`/issues`)
- `GET /issues` - Filter and search issues (status, priority, assignee).
- `POST /issues` - Create new issue with attachments.
- `PATCH /issues/:id` - Update issue (triggers history log).
- `POST /issues/:id/comments` - Add discussion point.
- `POST /issues/:id/attachments` - Upload new files.

<a name="stats-api"></a>
### 📊 Stats & Dashboard
- `GET /dashboard/stats` - General overview of company tasks.
- `GET /reports/stats` - Detailed analytical reports.

---

## 8. Production Image Storage
⚠️ **IMPORTANT FOR DEPLOYMENT**

By default, this application stores images on the **Local File System** in the `/uploads` folder.

If you deploy this backend to platforms like **Render** or **Cyclic**:
- These servers are **Ephemeral**, meaning they wipe their disk on every restart.
- **Result**: Your uploaded images will be deleted every day.

**Recommendation**: For production, refactor `multer` to use **Cloudinary** or **AWS S3**. This ensures images are stored permanently in the cloud, independent of the server's state.

---

## 9. Error Handling
The API uses a standardized error response format:
```json
{
  "success": false,
  "message": {
    "error_type": "The category of error",
    "error_message": "Human readable message",
    "details": "Stack trace (enabled only in development)"
  }
}
```

---

## 10. License
This project is licensed under the MIT License.
