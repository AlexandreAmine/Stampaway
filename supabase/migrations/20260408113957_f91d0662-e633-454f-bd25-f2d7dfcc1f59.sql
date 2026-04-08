
CREATE TABLE public.yearly_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  continent TEXT NOT NULL DEFAULT 'total',
  country_goal INTEGER NOT NULL DEFAULT 0,
  city_goal INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, continent)
);

CREATE TABLE public.yearly_goal_places (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, place_id)
);

ALTER TABLE public.yearly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yearly_goal_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Goals viewable by everyone" ON public.yearly_goals FOR SELECT USING (true);
CREATE POLICY "Users can manage own goals" ON public.yearly_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.yearly_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.yearly_goals FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Goal places viewable by everyone" ON public.yearly_goal_places FOR SELECT USING (true);
CREATE POLICY "Users can manage own goal places" ON public.yearly_goal_places FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goal places" ON public.yearly_goal_places FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goal places" ON public.yearly_goal_places FOR DELETE USING (auth.uid() = user_id);
