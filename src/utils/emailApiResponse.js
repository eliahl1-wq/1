export async function readEmailApiResponse(response) {
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch {
        if (response.status === 404) {
            throw new Error('Email changes are temporarily unavailable. The server needs to be updated. Please try again later.');
        }
        throw new Error(`The email service is temporarily unavailable (HTTP ${response.status}). Please try again later.`);
    }
    if (!response.ok) throw new Error(data?.message || 'Could not complete the email request. Please try again.');
    return data;
}
