
export interface SocialLead {
    external_id: string;
    name: string;
    email: string;
    phone?: string;
    source: 'facebook' | 'linkedin';
    created_time: string;
    ad_name?: string;
    form_name?: string;
}

export const socialIntegration = {
    /**
     * Fetch leads from Facebook Graph API
     * Note: This connects directly from the browser. Ensure your domain is allowed in FB App settings.
     */
    async fetchFacebookLeads(pageId: string, accessToken: string): Promise<SocialLead[]> {
        try {
            // 1. Fetch leads from the Edge
            // Reference: https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving-leads/
            const response = await fetch(
                `https://graph.facebook.com/v19.0/${pageId}/leadgen_forms?fields=leads{created_time,id,field_data},name&access_token=${accessToken}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to fetch Facebook leads');
            }

            const data = await response.json();
            const leads: SocialLead[] = [];

            // Facebook returns leads grouped by form
            if (data.data && Array.isArray(data.data)) {
                for (const form of data.data) {
                    if (form.leads && form.leads.data) {
                        for (const lead of form.leads.data) {
                            const fieldData = lead.field_data || [];
                            const getField = (name: string) =>
                                fieldData.find((f: any) => f.name === name || f.name.includes(name))?.values?.[0];

                            // Try to map common fields
                            leads.push({
                                external_id: lead.id,
                                name: getField('full_name') || `${getField('first_name') || ''} ${getField('last_name') || ''}`.trim() || 'Facebook User',
                                email: getField('email') || '',
                                phone: getField('phone_number') || '',
                                source: 'facebook',
                                created_time: lead.created_time,
                                form_name: form.name,
                            });
                        }
                    }
                }
            }

            return leads;
        } catch (error) {
            console.error('Facebook Sync Error:', error);
            throw error;
        }
    },

    /**
     * Fetch leads from LinkedIn API
     * Note: LinkedIn APIs often require server-side calls due to CORS. 
     * This function assumes you have a valid Bearer token.
     */
    async fetchLinkedInLeads(accountId: string, accessToken: string): Promise<SocialLead[]> {
        try {
            // Direct browser calls to LinkedIn API often fail due to CORS.
            // PROXY STRATEGY: In a real app, you would send the token to your backend, 
            // and the backend would request https://api.linkedin.com/rest/leadFormResponses

            // For this implementation, we will attempt the fetch, but if it fails (likely),
            // we will throw a descriptive error.

            const response = await fetch(`https://api.linkedin.com/rest/leadFormResponses?q=owner&owner=(sponsoredAccount:urn:li:sponsoredAccount:${accountId})`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'LinkedIn-Version': '202401',
                    'X-Restli-Protocol-Version': '2.0.0'
                }
            });

            if (!response.ok) {
                // Handle common CORS or Auth errors
                throw new Error('LinkedIn connection requires a backend proxy. Browser-to-API calls are restricted by LinkedIn.');
            }

            await response.json();
            // Parsing logic would go here if valid data returned
            return [];
        } catch (error) {
            console.error('LinkedIn Sync Error:', error);
            throw error;
        }
    }
};
