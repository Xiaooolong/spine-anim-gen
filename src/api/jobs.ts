export async function createJob(formData: FormData): Promise<{ jobId: string }> {
  const res = await fetch('/api/jobs', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('create job failed');
  return res.json();
}

export async function getJob(id: string) {
  const res = await fetch(`/api/jobs/${id}`);
  if (res.status === 404) return null as any;
  if (!res.ok) throw new Error('get job failed');
  return res.json();
}

export async function listJobs() {
  const res = await fetch('/api/jobs');
  if (!res.ok) throw new Error('list jobs failed');
  return res.json();
}

export async function getArtifacts(id: string) {
  const res = await fetch(`/api/jobs/${id}/artifacts`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error('get artifacts failed');
  return res.json();
}
