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
  * User authentication (sign up / log in / log out)  
  * Profile creation: interests, likes/dislikes, age, country of residence, education level, career path  
  * Allow users to edit profile and switch career paths  
* **Roadmap**  
  * AI agent generates personalized roadmap(s) from profile data  
  * Present roadmap as a sequence of steps/tasks  
  * Regenerate/update roadmap when user changes their path  
* **Task Completion & Portfolio**  
  * Mark a roadmap step/task as complete  
  * Upload evidence for a completed task (photo, certificate file)  
  * AI-verify uploaded certificates for authenticity / relevance (using Llama 3 Vision)  
  * Store uploaded evidence as part of user's portfolio  
  * Evidence files stored in object storage (S3-compatible), not on local server disk  
* **Resume Building**  
  * Auto-generate resume content from completed tasks + portfolio  
  * Allow user to review/edit AI-generated resume  
* **Data**  
  * Store agent interaction/training data tied to each user  
  * Store all of the above in a database  
* **Opportunity discovery**  
  * Retrieve job/career opportunities, events, and organizations relevant to the user's field  
  * Filter opportunities by: location, pay, age requirement, experience required  
* **AI Mentor / Chatbot**  
  * Persistent chat interface, accessible from anywhere in the app  
  * Chatbot maintains full conversation history per user  
  * Chatbot has tool-calling access to: roadmap state, portfolio/task data, opportunity search, profile data  
  * Users can trigger actions conversationally  
  * Chatbot answers open-ended career/mentorship questions using user context

**Non-Functional Requirements:**

* **Security**: Encrypt user data and chat history at rest and in transit; secure password handling; JWT auth  
* **Usability**: Aesthetically display the roadmap; user-friendly navigation; fast filtering  
* **Performance**: TBD

**Out of Scope:**

* Translation feature  
* Job application / employer matching

**Decisions Log:**

* Evidence storage: free-tier S3-compatible buckets  
* Auth: Supabase database trigger for user row creation
