# Marketing Tracking Dashboard Requirements Document

## 1. Application Overview

### 1.1 Application Name
Marketing Tracking Dashboard

### 1.2 Application Description
A comprehensive dashboard system for tracking marketing leads from multiple sources (website forms, Facebook, LinkedIn, SEO), managing SEO meta tags, and enabling sales team follow-up with lead status tracking. The system includes role-based access control with Admin, Sales, SEO, and Client user roles, along with internal messaging and note-taking capabilities for lead management.

## 2. Core Features

### 2.1 Lead Management
- Capture and display leads from multiple sources: website forms, Facebook, LinkedIn, and SEO marketing
- Track lead data fields including: lead name, email, phone, source channel, timestamp, and conversion status
- Assign leads to sales users and SEO users
- Lead status tracking with options: Pending, Completed, Remainder
- Date and time tracking for each lead status update
- Follow-up tracking capability for assigned users
- Add notes to assigned leads for internal tracking and documentation
- Internal messaging system for conversations related to specific leads

### 2.2 SEO Meta Tag Management
- Create, update, and delete SEO meta tags for website pages
- Manage SEO title, keywords, and description fields
- Apply meta tags to site pages

### 2.3 Dashboard Visualization
- Display all leads with their current status
- Show lead distribution by source (Facebook, LinkedIn, form submissions, SEO)
- View assigned leads by user (sales and SEO team members)
- Track lead status changes with date and time stamps
- Overview of pending, completed, and remainder leads

### 2.4 User Role Management
- **Admin Role**: Full access to all dashboard features and activities, including user management and permission configuration
- **Sales Role**: Access to assigned leads with configurable read/write permissions set by Admin
- **SEO Role**: Access to SEO meta tag management and assigned leads with configurable read/write permissions set by Admin
- **Client Role**: Paid access with configurable read/write permissions set by Admin

### 2.5 Permission Control System
- Admin can configure read and write access for Sales, SEO, and Client roles
- Granular permission settings for different dashboard features and activities
- Activity logging for all actions performed in the dashboard

### 2.6 Communication System
- Note-taking functionality for each assigned lead
- Message system for internal conversations about leads
- Conversation history tracking with timestamps
- Ability to view all notes and messages related to a specific lead

## 3. Technical Requirements

### 3.1 Frontend
- Built with React

### 3.2 Backend
- MySQL database for data storage

## 4. Key Data Fields

### 4.1 Lead Information
- Lead ID
- Lead name
- Email
- Phone
- Source channel (Facebook, LinkedIn, Form, SEO)
- Timestamp (creation date and time)
- Assigned user (sales or SEO user)
- Status (Pending, Completed, Remainder)
- Status update date and time
- Follow-up notes

### 4.2 SEO Meta Tags
- Page identifier
- SEO title
- Keywords
- Description
- Creation/update timestamp

### 4.3 User Information
- User ID
- Username
- Role (Admin, Sales, SEO, Client)
- Access permissions (read/write settings)
- Client payment status (for Client role)

### 4.4 Activity Log
- Activity ID
- User ID
- Action performed
- Timestamp
- Affected resource/data

### 4.5 Notes and Messages
- Note/Message ID
- Lead ID
- User ID (author)
- Content
- Timestamp
- Message type (note or conversation message)