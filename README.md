🛡️ Defend - Cyberbullying Detection Extension

Defend is a browser extension that uses a local AI model to detect and hide toxic or cyberbullying comments on social media platforms in real-time. 

Currently supported platforms:
* Instagram
* Facebook
* Features

Real-time Detection: As you scroll, comments are scanned and analyzed with a local ONNX AI model.
Rather than immediately remove toxic comments, it will overlay them with a “Toxic Comment Detected” card displaying the confidence level.
On the overlay card, you can:
Toggle the hidden/showed effect of the toxic comment.
 Block the user (best on Instagram).
 Click Copy evidence and open the platform's reporting page.
Download a comment file with the comment, author and timestamp in a .txt file.Save a .txt evidence file that contains comments, author and time stamp.
Privacy First: The AI model operates in the user's browser, so privacy is respected. No data is sent to external servers.

 Technologies Used
  JavaScript (Manifest V3)
   HTML / CSS
   ONNX Runtime Web
    Vite (for bundling)

Setup & Installation Instructions

Due to the large size of the AI model (more than 500 MB), it is available separately on Hugging Face. To run the project locally:

1. Click to download the AI Model.
Download the two files below from Hugging Face and store them in the `public/model/` folder of this project:
*   [Download cyberbullying_model.onnx](https://huggingface.co/neha-7/cyberbullying-detection/blob/main/cyberbullying_model.onnx)
*   [Download cyberbullying_model.onnx.data](https://huggingface.co/neha-7/cyberbullying-detection/resolve/main/cyberbullying_model.onnx.data)

The folder structure should be: public/model/cyberbullying_model.onnx, and public/model/cyberbullying_model.onnx.data.

### 2. Install Dependencies
In the project folder open the terminal and execute:
npm install
npm run build
Go to chrome://extensions/
