'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import Loader from '@/components/Loader';
import { BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function StudentSubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    fetch('/api/subjects')
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) {
          throw new Error(data?.error ?? r.statusText ?? `Request failed with status ${r.status}`);
        }
        return data;
      })
      .then(d => {
        if (isMounted) setSubjects(d.subjects || []);
      })
      .catch(err => {
        if (isMounted) toast({ title: 'Error', description: err.message, variant: 'destructive' });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, [toast]);

  if (isLoading) return <div className="flex justify-center p-12"><Loader /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-sky-900">My Subjects</h1>
        <p className="text-sky-600">Subjects available in your institution.</p>
      </div>

      {subjects.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 bg-white rounded-2xl border border-dashed border-sky-200">
          <BookOpen className="h-12 w-12 text-sky-200" />
          <p className="text-sky-700 font-medium">No subjects added yet by your admin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((s: any) => (
            <Card key={s.id} className="bg-white border-sky-100 hover:shadow-md transition-all">
              <CardContent className="pt-6 flex flex-col gap-1">
                {s.code && <span className="text-xs font-mono text-sky-400 bg-sky-50 w-fit px-2 py-0.5 rounded">{s.code}</span>}
                <p className="font-semibold text-gray-900 text-lg mt-1">{s.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
