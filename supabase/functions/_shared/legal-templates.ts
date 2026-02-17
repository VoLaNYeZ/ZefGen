export type LegalTemplateInput = {
    companyName: string;
    appStoreName: string;
    supportEmail: string;
    generatedAtIso: string;
};

export type SupportOptionalFieldKey = 'name' | 'device_model' | 'os';

export type SupportFormField = {
    key: string;
    label: string;
    required: boolean;
    paragraph: boolean;
};

export type SupportFormPlan = {
    title: string;
    description: string | null;
    subtitleVariant: string | null;
    fields: SupportFormField[];
    schema: {
        required: string[];
        optional: SupportOptionalFieldKey[];
        subtitle: string | null;
    };
};

const subtitleVariants = [
    'Leave your feedback.',
    'Share your experience with us.',
    'Tell us what happened and we will help.',
    'Send details and our support team will respond.',
    'We read every support request carefully.',
];

const randomUnit = () => {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return bytes[0] / 0xffffffff;
};

const chance = (probability: number) => randomUnit() < probability;

const toLegalDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().slice(0, 10);
};

const TERMS_TEMPLATE_RAW = `///Terms & Conditions
These terms and conditions apply to the #APPNAME# app (hereby referred to as "Application") for mobile devices that was created by #COMPANYNAME# (hereby referred to as "Service Provider") as a Free service.

Upon downloading or utilizing the Application, you are automatically agreeing to the following terms. It is strongly advised that you thoroughly read and understand these terms prior to using the Application.

Unauthorized copying, modification of the Application, any part of the Application, or our trademarks is strictly prohibited. Any attempts to extract the source code of the Application, translate the Application into other languages, or create derivative versions are not permitted. All trademarks, copyrights, database rights, and other intellectual property rights related to the Application remain the property of the Service Provider.

The Service Provider is dedicated to ensuring that the Application is as beneficial and efficient as possible. As such, they reserve the right to modify the Application or charge for their services at any time and for any reason. The Service Provider assures you that any charges for the Application or its services will be clearly communicated to you.

The Application stores and processes personal data that you have provided to the Service Provider in order to provide the Service. It is your responsibility to maintain the security of your phone and access to the Application. The Service Provider strongly advise against jailbreaking or rooting your phone, which involves removing software restrictions and limitations imposed by the official operating system of your device. Such actions could expose your phone to malware, viruses, malicious programs, compromise your phone's security features, and may result in the Application not functioning correctly or at all.

Please be aware that the Service Provider does not assume responsibility for certain aspects. Some functions of the Application require an active internet connection, which can be Wi-Fi or provided by your mobile network provider. The Service Provider cannot be held responsible if the Application does not function at full capacity due to lack of access to Wi-Fi or if you have exhausted your data allowance.

If you are using the application outside of a Wi-Fi area, please be aware that your mobile network provider's agreement terms still apply. Consequently, you may incur charges from your mobile provider for data usage during the connection to the application, or other third-party charges. By using the application, you accept responsibility for any such charges, including roaming data charges if you use the application outside of your home territory (i.e., region or country) without disabling data roaming. If you are not the bill payer for the device on which you are using the application, they assume that you have obtained permission from the bill payer.

Similarly, the Service Provider cannot always assume responsibility for your usage of the application. For instance, it is your responsibility to ensure that your device remains charged. If your device runs out of battery and you are unable to access the Service, the Service Provider cannot be held responsible.

In terms of the Service Provider's responsibility for your use of the application, it is important to note that while they strive to ensure that it is updated and accurate at all times, they do rely on third parties to provide information to them so that they can make it available to you. The Service Provider accepts no liability for any loss, direct or indirect, that you experience as a result of relying entirely on this functionality of the application.

The Service Provider may wish to update the application at some point. The application is currently available as per the requirements for the operating system (and for any additional systems they decide to extend the availability of the application to) may change, and you will need to download the updates if you want to continue using the application. The Service Provider does not guarantee that it will always update the application so that it is relevant to you and/or compatible with the particular operating system version installed on your device. However, you agree to always accept updates to the application when offered to you. The Service Provider may also wish to cease providing the application and may terminate its use at any time without providing termination notice to you. Unless they inform you otherwise, upon any termination, (a) the rights and licenses granted to you in these terms will end; (b) you must cease using the application, and (if necessary) delete it from your device.

Changes to These Terms and Conditions
The Service Provider may periodically update their Terms and Conditions. Therefore, you are advised to review this page regularly for any changes. The Service Provider will notify you of any changes by posting the new Terms and Conditions on this page.

These terms and conditions are effective as of #DATECREATION#

Contact Us
If you have any questions or suggestions about the Terms and Conditions, please do not hesitate to contact the Service Provider at #EMAIL#.`;

const PRIVACY_TEMPLATE_RAW = `///Privacy Policy
This privacy policy applies to the ##APPNAME## app (hereby referred to as "Application") for mobile devices that was created by #COMPANY NAME# (hereby referred to as "Service Provider") as a Free service. This service is intended for use "AS IS".

Information Collection and Use
The Application collects information when you download and use it. This information may include information such as
- Your device's Internet Protocol address (e.g. IP address)
- The pages of the Application that you visit, the time and date of your visit, the time spent on those pages
- The time spent on the Application
- The operating system you use on your mobile device

The Application does not gather precise information about the location of your mobile device.

The Service Provider may use the information you provided to contact you from time to time to provide you with important information, required notices and marketing promotions.

For a better experience, while using the Application, the Service Provider may require you to provide us with certain personally identifiable information. The information that the Service Provider request will be retained by them and used as described in this privacy policy.

Third Party Access
Only aggregated, anonymized data is periodically transmitted to external services to aid the Service Provider in improving the Application and their service. The Service Provider may share your information with third parties in the ways that are described in this privacy statement.

The Service Provider may disclose User Provided and Automatically Collected Information:
as required by law, such as to comply with a subpoena, or similar legal process;
when they believe in good faith that disclosure is necessary to protect their rights, protect your safety or the safety of others, investigate fraud, or respond to a government request;
with their trusted services providers who work on their behalf, do not have an independent use of the information we disclose to them, and have agreed to adhere to the rules set forth in this privacy statement.

Opt-Out Rights
You can stop all collection of information by the Application easily by uninstalling it. You may use the standard uninstall processes as may be available as part of your mobile device or via the mobile application marketplace or network.

Data Retention Policy
The Service Provider will retain User Provided data for as long as you use the Application and for a reasonable time thereafter. If you'd like them to delete User Provided Data that you have provided via the Application, please contact them at ##EMAIL## and they will respond in a reasonable time.

Children
The Service Provider does not use the Application to knowingly solicit data from or market to children under the age of 13.


The Service Provider does not knowingly collect personally identifiable information from children. The Service Provider encourages all children to never submit any personally identifiable information through the Application and/or Services. The Service Provider encourage parents and legal guardians to monitor their children's Internet usage and to help enforce this Policy by instructing their children never to provide personally identifiable information through the Application and/or Services without their permission. If you have reason to believe that a child has provided personally identifiable information to the Service Provider through the Application and/or Services, please contact the Service Provider (davidsarac@inokresort.com) so that they will be able to take the necessary actions. You must also be at least 16 years of age to consent to the processing of your personally identifiable information in your country (in some countries we may allow your parent or guardian to do so on your behalf).

Security
The Service Provider is concerned about safeguarding the confidentiality of your information. The Service Provider provides physical, electronic, and procedural safeguards to protect information the Service Provider processes and maintains.

Changes
This Privacy Policy may be updated from time to time for any reason. The Service Provider will notify you of any changes to the Privacy Policy by updating this page with the new Privacy Policy. You are advised to consult this Privacy Policy regularly for any changes, as continued use is deemed approval of all changes.

This privacy policy is effective as of #DATECREATION#

Your Consent
By using the Application, you are consenting to the processing of your information as set forth in this Privacy Policy now and as amended by us.

Contact Us
If you have any questions regarding privacy while using the Application, or have questions about the practices, please contact the Service Provider via email at #EMAIL#.`;

const findUnresolvedPlaceholders = (text: string) =>
    Array.from(new Set(text.match(/#{1,2}[A-Za-z][A-Za-z0-9 _-]*#{1,2}/g) || []));

const applyLegalTemplate = (template: string, input: LegalTemplateInput, date: string) => {
    let output = template.replace(/^\/\/\/\s*(.+)$/m, '$1');

    const replacementRules: Array<[RegExp, string]> = [
        [/##?APPNAME##?/gi, input.appStoreName],
        [/##?COMPANYNAME##?/gi, input.companyName],
        [/##?COMPANY\s+NAME##?/gi, input.companyName],
        [/##?EMAIL##?/gi, input.supportEmail],
        [/##?DATECREATION##?/gi, date],
    ];

    for (const [pattern, replacement] of replacementRules) {
        output = output.replace(pattern, replacement);
    }

    output = output.replace(/davidsarac@inokresort\.com/gi, input.supportEmail);

    const unresolved = findUnresolvedPlaceholders(output);
    if (unresolved.length > 0) {
        console.warn(`[legal-templates] Unresolved placeholders: ${unresolved.join(', ')}`);
    }

    return output;
};

export const renderPrivacyPolicy = (input: LegalTemplateInput) => {
    const date = toLegalDate(input.generatedAtIso);
    return applyLegalTemplate(PRIVACY_TEMPLATE_RAW, input, date);
};

export const renderTermsOfUse = (input: LegalTemplateInput) => {
    const date = toLegalDate(input.generatedAtIso);
    return applyLegalTemplate(TERMS_TEMPLATE_RAW, input, date);
};

export const buildSupportFormPlan = (input: Pick<LegalTemplateInput, 'appStoreName'>): SupportFormPlan => {
    const optional: SupportOptionalFieldKey[] = [];
    if (chance(0.25)) optional.push('name');
    if (chance(0.1)) optional.push('device_model');
    if (chance(0.1)) optional.push('os');

    const subtitle = chance(0.3)
        ? subtitleVariants[Math.floor(randomUnit() * subtitleVariants.length)] || subtitleVariants[0]
        : null;

    const fields: SupportFormField[] = [
        { key: 'email', label: 'Email', required: true, paragraph: false },
        { key: 'question', label: 'Your question', required: true, paragraph: true },
    ];

    if (optional.includes('name')) fields.push({ key: 'name', label: 'Name', required: false, paragraph: false });
    if (optional.includes('device_model')) {
        fields.push({ key: 'device_model', label: 'Device model', required: false, paragraph: false });
    }
    if (optional.includes('os')) fields.push({ key: 'os', label: 'OS', required: false, paragraph: false });

    return {
        title: `${input.appStoreName} Support`,
        description: subtitle,
        subtitleVariant: subtitle,
        fields,
        schema: {
            required: ['email', 'question'],
            optional,
            subtitle,
        },
    };
};
