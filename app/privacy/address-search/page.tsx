import type {Metadata} from 'next';
import Link from 'next/link';

export const metadata:Metadata={
 title:'Address search and location privacy | TrustFive',
 description:'Learn what TrustFive shares with address lookup providers and how private job-site locations are handled.'
};

/**
 * Public disclosure of the existing /api/address/search implementation.
 * This page must be updated whenever geocoding providers or retention change.
 */
export default function AddressLocationPrivacy(){
 return <main className="container">
  <div className="page-heading">
   <span className="eyebrow">Privacy and transparency</span>
   <h1>Address search and location privacy</h1>
   <p className="subtle">What happens when you search for an address or postcode in TrustFive.</p>
  </div>
  <div className="card" style={{maxWidth:800}}>
   <h2>Where your search goes</h2>
   <p>TrustFive sends the location text you type to its own address-search service. The service may then send the search text to an external lookup provider to return suggestions:</p>
   <ul>
    <li><strong>UK postcode or postcode district:</strong> the lookup uses <a href="https://postcodes.io" rel="noopener noreferrer">postcodes.io</a>.</li>
    <li><strong>Street or property address:</strong> when configured, the lookup uses <a href="https://www.geoapify.com/" rel="noopener noreferrer">Geoapify</a>. If this provider is not configured, the app offers postcode lookup instead.</li>
   </ul>
   <p>These providers receive the submitted lookup text for the relevant request and may handle it under their own privacy practices. Avoid entering more personal information than necessary. Provider availability and geographic coverage may vary.</p>
   <h2>Finding a professional</h2>
   <p>TrustFive uses the selected location to calculate approximate proximity to approved professionals. Your home address is not added to public business listings. Selecting a location does not prove that your area has verified TrustFive coverage.</p>
   <h2>Posting a job</h2>
   <p>When you publish a job request, TrustFive needs your selected job-site details to store a private location associated with the job. Postcode-centre coordinates are approximate; where only a postcode is selected, the job form asks for further private property details. Avoid placing private addresses, telephone numbers or contact details in public job descriptions.</p>
   <h2>How long is my lookup retained?</h2>
   <p>The address-search endpoint requests results without caching them in the app's response. This is not a guarantee that third-party lookup providers keep no records. Exact third-party retention periods are governed by those providers' own terms. TrustFive must assess and document any provider-side retention before its production privacy notice is finalised.</p>
   <p><strong>Important:</strong> This is an explanation of the current address-search feature, not a substitute for a full legal privacy notice or an assertion that every international location is supported.</p>
   <p style={{marginTop:20}}><Link className="btn secondary" href="/services">Return to professional search</Link></p>
  </div>
 </main>;
}
