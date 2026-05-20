---
description: JavaScript best practices
globs: **/*.js
---

## Java-like Javascript code
- Write Javascript code that appears as much as possible like Java code
- User Object Orientation where possible
- Try to make sure that objects are as 'encapsulated' as possible
- Use of the singleton pattern is preferred to use of global variables that hold object instances

## Naming Conventions
- Use camelCase for variables and functions
- Use PascalCase for classes
- Use UPPERCASE for constants only when the constant is 'Global' otherwise use camelCase
- Use descriptive names with auxiliary verbs (e.g., `isLoading`, `hasError`)
- Use consistent naming across the codebase

## Code Organization
- One file per Class and one Class per file
- The length of files or lines of code is not important
- Group related functionality together

## Documentation
- Write clear javadoc style documentation above all methods
- Document complex algorithms
- Keep README files up to date
- Document configuration options
- Use meaningful commit messages

## Frameworks
- All code should be bespoke, do not use frameworks unless absolutely necessary
- Observe the bespoke frameworks currently implemented in the application and re-use them