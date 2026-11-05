import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { TodayPage } from "./Today";
import { IdeasPage } from "./Ideas";
import { GraphPage } from "./Graph";
import { TopicsPage } from "./Topics";
import { TopicPage } from "./TopicDetail";
import { ProjectsPage } from "./Projects";
import { ProjectPage } from "./ProjectDetail";
import { TimelinePage } from "./Timeline";
import { SettingsPage } from "./Settings";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<TodayPage />} />
        <Route path="ideas" element={<IdeasPage />} />
        <Route path="graph" element={<GraphPage />} />
        <Route path="topics" element={<TopicsPage />} />
        <Route path="topics/:topicId" element={<TopicPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectPage />} />
        <Route path="timeline" element={<TimelinePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
