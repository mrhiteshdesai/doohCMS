### **Overview**

## This document outlines the end-to-end process of setting up a Programmatic Guaranteed (PG) Video Deal in Google Ad Manager (GAM), configuring a DV360 campaign, and using the VAST tag from GAM to render a video ad in a DOOH player or platform.

## **Step 1: Create a Programmatic Guaranteed (PG) Video Deal in Google Ad Manager**

Follow these steps to create a video deal in GAM:

1. **Login to Google Ad Manager**  
    Access: https://admanager.google.com

2. **Navigate to Delivery \> Deals**

   * Click on **"Delivery" → "Deals" → "New deal"**

3. **Select Deal Type**

   * Choose **Programmatic Guaranteed (PG)** as the deal type.

4. **Define Buyer Information**

   * Select the **Buyer Network** as **Display & Video 360**.

   * Enter the **Advertiser or Partner Name** as per DV360 setup.

5. **Set Deal Terms**

   * **Deal Name:** Provide a unique, descriptive name (e.g., `DOOH_PG_Video_30s_Nov2025`)

   * **Inventory Type:** Select **Video**.

   * **Ad Unit / Inventory:** Choose the video placements or ad units you want to include in the deal.

   * **Rate Type:** Select **CPM (Cost per Mille)**.

   * **Price:** Enter agreed CPM (e.g., ₹150).

   * **Start/End Dates:** Define the campaign flight.

   * **Priority:** Standard (default for PG).

6. **Video Creative Specifications**

   * Set the **video duration** (e.g., 30 seconds).

   * Supported formats: **MP4**, **MOV**, or **VAST**.

   * Define the **aspect ratio** and **resolution** (e.g., 1920×1080).

   * Choose **Advertiser Managed Creative** or **Publisher Managed Creative** based on workflow.

     * *If Advertiser Managed:* Creative will be uploaded in DV360.

     * *If Publisher Managed:* Creative will be uploaded in GAM.

7. **Targeting Options (optional)**

   * Define any necessary targeting such as **geo-location**, **device type**, or **screen ID**.

8. **Save and Send Deal**

   * Once all details are configured, click **“Save and Send to Buyer”**.

   * The deal will now appear in **DV360 under Negotiations**.

---

## **Step 2: Create a Campaign in DV360**

Once the deal is created and sent to the buyer, perform the following in **DV360**:

1. **Login to Display & Video 360 (DV360)**

   * Access: https://displayvideo.google.com

2. **Navigate to Campaigns**

   * Click on **“Campaigns” → “New Campaign”**.

3. **Set Campaign Details**

   * **Name:** Match the GAM deal name for consistency.

   * **Advertiser:** Choose the advertiser account linked to the deal.

   * **Start/End Dates:** Match GAM deal duration.

   * **Budget Type:** Fixed or Daily (based on campaign objective).

   * **Inventory Source:** Select **Programmatic Guaranteed**.

4. **Targeting**

   * Set required targeting parameters (Geo, Device Type, Audience, Screen Location, etc.) as per DOOH requirements.

5. **Attach the Creative**

   * If **Advertiser Managed Creative (DV360)**:

     * Upload the video creative to DV360.

     * Ensure the **video duration matches the deal duration** (e.g., if the deal is 30 seconds, upload ≤30s creative).

     * Wait for **DV360 Creative Approval** — it must be **Approved/Servable** before delivery.

   * If **Publisher Managed Creative (GAM)**:

     * Creative will be added on the GAM side — skip this upload step.

6. **Link the Deal**

   * Go to **Negotiations → Search for the deal name from GAM**.

   * Accept the deal and **link it** to the corresponding **campaign** and **creative**.

   * Once linked, it becomes visible in **Inventory Source** under that campaign.

7. **Finalize Setup**

   * Ensure the campaign shows an **Insertion Order (IO)** (deal) and **Line Item** (creative).

   * Verify targeting, pacing, and bidding setup.

---

## **Step 3: Verify Creative Approval**

* Go to **Creatives → Review Status** in DV360.

* Ensure the creative status is **Approved** or **Servable**.

* If “Disapproved,” fix the issue as per DV360 feedback (e.g., format, click-through URL, or aspect ratio).

---

## **Step 4: Confirm Deal Linkage**

* In **DV360**, confirm that:

  * The **Deal Name** from GAM appears under **Inventory Sources**.

  * The deal is **Accepted**.

  * The campaign and creative are **linked to the deal**.

---

## **Step 5: Verify Campaign Setup**

* Open the **DV360 campaign view** and confirm:

  * **IO (Deal)**: Linked successfully.

  * **Line Item:** Mapped correctly to the creative.

  * **Targeting:** Matches the DOOH requirement.

  * **Creative Duration:** Matches the deal (e.g., 30s).

---

## **Step 6: Retrieve VAST Tag from Google Ad Manager**

Once everything is approved and linked:

1. **Go to GAM \> Delivery \> Orders \> Line Items.**

2. Locate the **Programmatic Guaranteed Video Line Item** associated with the deal.

3. Click the **“Tags”** option.

4. Choose **VAST Tag** as the tag type.

5. Select:

   * **Ad type:** Video

   * **Environment:** Web or App (as per DOOH player)

   * **URL Type:** Standard or Secure

6. Copy the generated **VAST Tag URL**.

---

## **Step 7: Use the VAST Tag in DOOH Platform**

Now, use the VAST tag to serve the video creative in your DOOH system:

1. **Integrate the VAST Tag in the DOOH Player**

   * Configure your DOOH software/player to fetch and render ads via VAST tags.

   * The player should:

     * Make an HTTP call to the VAST tag URL.

     * Parse the returned XML.

     * Retrieve the **Media File (MP4)** URL.

     * Play the video ad as per duration defined.

2. **Monitor Rendering**

   * Ensure the DOOH system logs impressions correctly.

   * Check that **tracking URLs** (impression and click trackers) fire successfully.

3. **Validate**

   * Test the tag in a VAST inspector (e.g., Google VAST Validator or IAB Test Suite).

   * Confirm the ad loads, plays, and tracks correctly.

---

## **Step 8: Monitoring and Reporting**

* In **GAM**: Check **Delivery Reports** for impressions, completions, and errors.

* In **DV360**: Monitor **Deal performance** under **Inventory \> Programmatic Guaranteed Deals**.

* In **DOOH Platform**: Validate **playback logs** and **tracking beacons**.

---

## **Best Practices**

* Always ensure **video creatives are transcoded and approved** before activating campaigns.

* Keep **GAM and DV360 deal parameters identical** (duration, price, targeting).

* Maintain **HTTPS-secured VAST tags** for better compatibility with players.

* Test the tag on a **sample DOOH unit or emulator** before mass deployment.

* Verify **VAST 2.0 or 4.1 compliance** based on player compatibility.

