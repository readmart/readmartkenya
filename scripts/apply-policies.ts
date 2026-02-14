import { supabase } from '../src/lib/supabase/client';

async function apply() {
  const sql = `
    CREATE POLICY "Admins can insert product versions" ON public.product_versions 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder', 'author')
        )
    );
    
    CREATE POLICY "Admins can update product versions" ON public.product_versions 
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Error applying policy:', error);
  } else {
    console.log('Policies applied successfully');
  }
}

apply();
