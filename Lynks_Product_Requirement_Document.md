Problem:

Young, ambitious individuals struggle to access career opportunities they're genuinely qualified for, often because unofficial networks (nepotism, existing connections) determine who gets opportunities rather than merit or effort. There's no reliable way for someone starting from zero to know what steps actually lead to their goal, and prove to an employer that they've done the work.

Goal:

Build a platform that gives each user a personalized, step-by-step roadmap toward a chosen career path, lets them build verifiable proof of progress (uploaded task evidence, certificates), and converts that verified progress into a resume and profile that gets surfaced directly to employers and closing the gap between "did the work" and "got the opportunity" without relying on personal connections.

Core user flows:

1. Users can enter interests  
2. Users can enter information such as age, country of residence, current level of education etc.  
3. Users can enter their preferred career path  
4. A.I agent presents roadmap along with supporting information  
5. Users are presented with steps to take within their career  
6. Users can document and complete steps to move along the roadmap  
7. Users can communicate with a chat bot for guidance and advice   
8. Users browse a tabbed section of job/career opportunities, events, and organizations relevant to their field  
9. Users can filter opportunities by location, pay, age requirement, and experience required

**Functional Requirements** (what the system does):

* **Account & Profile**  
  * Accept and store user account info (email, name, username)  
  * User authentication (sign up / log in / log out) — *moved here from non-functional; this is a feature, not a quality*  
  * Profile creation: interests, likes/dislikes, age, country of residence, education level, career path  
  * Allow users to edit profile and switch career paths  
* **Roadmap**  
  * AI agent generates personalized roadmap(s) from profile data  
  * Present roadmap as a sequence of steps/tasks  
  * Regenerate/update roadmap when user changes their path  
* **Task Completion & Portfolio**  
  * Mark a roadmap step/task as complete  
  * Upload evidence for a completed task (photo, certificate file)  
  * AI-verify uploaded certificates for authenticity / relevance (using Google Gemini 2.5 Flash — free tier)
    * Dual-provider architecture: Groq for text tasks (chat, roadmap, resume), Gemini Flash for vision (evidence verification)
    * Note: Impala/Highrise gateway is inaccessible — all LLM calls route through Groq (text) and Google AI Studio (vision)
    * Verification is career-context-aware: checks document type, content legitimacy, AND relevance to user's career path
    * Returns: verified/rejected + confidence level + reason + detected issuer
    * Users can request re-verification if evidence was incorrectly rejected  
  * Store uploaded evidence as part of user's portfolio  
  * Evidence files stored in object storage (S3-compatible), not on local server disk; database stores the fileURL, not the file itself.  
* **Resume Building**  
  * Auto-generate resume content from completed tasks \+ portfolio  
  * Allow user to review/edit AI-generated resume  
* **Data**  
  * Store agent interaction/training data tied to each user  
  * Store all of the above in a database  
* **Opportunity discovery**  
  * Retrieve job/career opportunities, events, and organizations relevant to the user's field (sourced via job-board API) Present opportunities in a tabbed, browsable section  
  * Filter opportunities by: location, pay, age requirement, experience required  
* **AI Mentor / Chatbot**  
  * Persistent chat interface, accessible from anywhere in the app  
  * Chatbot maintains full conversation history per user  
    * Chatbot uses up to a certain amount of messages for context, then summarizes the preceding messages into one singular message for cleaner data storing.  
  * Chatbot has tool-calling access to: roadmap state, portfolio/task data, opportunity search, profile data  
  * Users can trigger actions conversationally (mark task complete, regenerate roadmap, search opportunities) without leaving the chat  
  * Chatbot answers open-ended career/mentorship questions using user context (current step, career path, completed tasks)

**Non-Functional Requirements** (how well the system does it):

* **Security**:   
  * Encrypt user data and chat history at rest and in transit; secure password handling  
  * Authentication via JWT: issued on successful login, required in the Authorization header on all protected endpoints; invalid or missing token returns 401   
* **Usability**:   
  * Aesthetically display the roadmap; user-friendly menu/navigation; settings and customization tabs  
  * Opportunity data should be reasonably current (needs a freshness target later, e.g. "refreshed daily")  
  * Tabbed browsing interface should be fast to filter/s  
* **Performance**: (not yet specified — worth deciding later how fast roadmap generation should feel, e.g. "under 10 seconds")

**Out of Scope** (starting this section):

* Translation feature  
* Job application / employer matching

**Decisions Log:**

* **Evidence storage provider**  
  * TBD, leaning toward free-tier S3-compatible buckets — decide before Portfolio Manager work starts.   
* Create a trigger that creates a new row in public.users upon the creation of a new row in auth.users

**Lynks API Surface Sketch**

*All endpoints except /signup and /login require a JWT in the Authorization: Bearer \<token\> header.*

*Account & Profile*

| Method | Path | Purpose |
| ----- | ----- | ----- |
| POST | `/signup` | Create a new user account |
| POST | `/login` | Authenticate user, return session/token |
| POST | `/logout` | End user session |
| GET | `/profile` | Get the logged-in user's profile |
| PATCH | `/profile` | Update profile fields (interests, education, career path, etc.) |
| PATCH | `/profile/career-path` | Switch to a new chosen career path |

*Roadmap*

| Method | Path | Purpose |
| ----- | ----- | ----- |
| POST | `/roadmap/generate` | Trigger the Career Architect agent to build a roadmap from the user's profile |
| GET | `/roadmap` | Get the user's current roadmap and its steps |
| POST | `/roadmap/regenerate` | Rebuild the roadmap after a career path change |

*Task Completion & Portfolio*

| Method | Path | Purpose |
| ----- | ----- | ----- |
| GET | `/tasks` | List steps/tasks on the current roadmap |
| PATCH | `/tasks/{task_id}/complete` | Mark a specific task as completed |
| POST | `/tasks/{task_id}/evidence` | Upload a photo/certificate as proof for a task |
| GET | `/portfolio` | Get all completed tasks \+ uploaded evidence for the user |

*Resume Building*

| Method | Path | Purpose |
| ----- | ----- | ----- |
| POST | `/resume/generate` | Generate resume content from completed tasks/portfolio |
| GET | `/resume` | Get the current (AI-generated or edited) resume |
| PATCH | `/resume` | Let user edit generated resume content |
| GET | `/resume/download` | Export resume as a downloadable file |

*Opportunity Discovery*

| Method | Path | Purpose |
| ----- | ----- | ----- |
| GET | `/opportunities` | List job/career opportunities, events, orgs matched to the user's field |
| GET | `/opportunities?location=&pay=&age=&experience=` | Same, filtered by query parameters |

*Chat Bot*

| Method | Path | Purpose |
| ----- | ----- | ----- |
| POST | `/chat/message` | Send a message, get mentor response (may include tool calls) |
| GET | `/chat/history` | Retrieve conversation history |
| DELETE | `/chat/history` | Clear conversation (nice to have) |
