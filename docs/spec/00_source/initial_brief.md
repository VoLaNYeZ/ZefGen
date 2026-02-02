# Initial Brief
ZefGen eventual goal's is to be a CRM that keeps bunch of images, allows to generate new ones and some data of the apps in brands. (Later more options with dev files):
______________
So at the existing left sidebar :
 brands that will be added by the user. 
Each brand is like our Adidas basically. And inside it will have image references for generations :
References collection of the brand - for ICON (picture+textbox for AI enhancement), for screenshots (images for each screenshot+textbox). This is should basically be on the top side of the page. 
_____________
Under that, we'll have apps section - there could be many apps, for now it's all added by the user. Every app's LINK should always be a proper one (zefgen.com/brand/HW) and lead to each app.
_____________
The list of app should be very intuitive, modern design, easy switchable between those apps and so on.
Each app has its own name, the ALIAS (ZeyfASO also had it), they will need to have screenshots of the app from simulator that user should be able to upload (in an order and is able to reorder) etc saved and shown on the page under each app. 
Features under each app will be like these: 
1) generate icon for the app (1024x1024) - basically will rely on the brand's icon and text description 
The goal will be to
2) generate Appstore screenshots (choose amount 3-6) relying on brand reference descriptions and sim screenshots user uploaded. Images should always fit apple guidelines and be 6.5''(by default) or 6.9'' (with a proper resolution).
They way its being done is through API.
2.1) Have a edit-mode on each image for these screenshots (many different fonts, its movement, what other instruments would be good to have to quickly edit appstore screenshots?)
3) below it - there are different fields of metadata "App Data" for now placeholder, will complete later.
4) even lower - dev files - also placeholder.

-- I used supabase before for keeping the data in tables,  but no idea how to do it for images :)

## Notes
- Project type: user-facing web app with backend support and API usage.
- UI: full UI; existing login page must remain unchanged.
- Core outcome: users complete workflows (create brand/app, upload, generate assets).
- Entities (proposed): Brand, App, ImageAsset, Reference, AppMetadata.
- Storage: cloud backend.
- Auth: simple auth.
- Integrations: many (at least image generation + storage).
- NFR priorities: speed of delivery + maintainability (security baseline desired).
- Scope: feature-complete v1.
- Done: production-ready (errors, edge cases, basic tests).
- Canonical app URL uses brand slug + app alias (example: `/adidas/hw200`), and updates when brand/app names or aliases change.
- App Data placeholders required: AppId, BundleID, Company Name, id_purchases, Apphud API URL, Privacy Policy, Term of Use, Support Form, Domain, Appstore Description.
- Image constraints: 1 icon; up to 6 App Store screenshots; 10 MB max per file; icon must be JPG; uploads accept PNG/JPG with conversion to JPG for storage where needed.
- App Store screenshot sizes: 6.5'' = 1242x2688 (default), 6.9'' = 1320x2868 (optional).
- Screenshot editor tools: multiple fonts, text positioning/sizing/rotation, and basic text layer adding; inpainting deferred.
- Generation APIs: Replicate “nanobanana” and ChatGPT image 1.5 (most likely).
- Asset versioning: up to 3 versions per generated screenshot; after that, user must delete one to continue.
