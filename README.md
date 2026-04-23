# FeedTrace AI: Full-Stack Review Verification System 🛡️🤖

> **Solving E-commerce Trust Issues with AI-Powered OCR Verification**

FeedTrace AI is an end-to-end ecosystem designed to eliminate fake reviews. By requiring users to upload proof of purchase, the system uses AI to scan invoices, verify data, and assign a "Trust Score" to every review, ensuring 100% transparency for shoppers.

---

## 📂 Project Architecture & Repositories
This project is built as a distributed full-stack application. Explore the components below:

* 🖥️ **Backend API (The Core):** [https://github.com/Chakriroy11/feedtrace-backend](https://github.com/Chakriroy11/feedtrace-backend)
  * *Handles AI logic, Database, OCR processing, and Email automation.*
* 📱 **User Client (Frontend):** [https://github.com/Chakriroy11/feedtrace-client](https://github.com/Chakriroy11/feedtrace-client)
  * *The shopper's portal for browsing products and submitting verified reviews.*
* ⚙️ **Admin Dashboard:** [https://github.com/Chakriroy11/feedtrace-admin](https://github.com/Chakriroy11/feedtrace-admin)
  * *The moderation hub for verifying proof, managing status, and viewing deep analytics.*

---

## ✨ Key Features
* **AI OCR Engine:** Uses **Tesseract.js** to scan bills for Order IDs, dates, and product names.
* **Automated Trust Scoring:** Assigns a percentage-based score based on OCR match accuracy.
* **Media Management:** Offloads high-res image storage to **Cloudinary** for speed and scale.
* **Admin Analytics:** Interactive data visualization using **Recharts** to track platform integrity.
* **Email Notifications:** Real-time feedback via **SendGrid** when reviews are received or verified.
* **Responsive Design:** Fully optimized for mobile and desktop using **Tailwind CSS**.

---

## 🛠️ Technical Stack
| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React.js (Vite), Tailwind CSS, Lucide Icons |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB Atlas (NoSQL) |
| **AI / ML** | Tesseract.js (Optical Character Recognition) |
| **Cloud** | Cloudinary (Media), SendGrid (SMTP) |
| **Testing** | Postman, Manual Unit Testing |

---

## ⚙️ Installation & Setup

1. **Clone the full project:**
   ```bash
   git clone [https://github.com/Chakriroy11/feedtrace-backend.git](https://github.com/Chakriroy11/feedtrace-backend.git)
   git clone [https://github.com/Chakriroy11/feedtrace-client.git](https://github.com/Chakriroy11/feedtrace-client.git)
   git clone [https://github.com/Chakriroy11/feedtrace-admin.git](https://github.com/Chakriroy11/feedtrace-admin.git)
