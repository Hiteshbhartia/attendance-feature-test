import React, { useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useAuth } from "@/contexts/AuthContext";
import { useAttendanceState } from "@/hooks/useAttendance";
import { tierOf } from "@/lib/permissions";
import { useRoleFeature } from "@/hooks/useRoleFeature";

export function OnboardingTour() {
  const { user } = useAuth();
  const { actor } = useAttendanceState();
  const tier = tierOf(actor);
  const isFeatureEnabled = useRoleFeature();

  useEffect(() => {
    if (!user || !actor) return;

    const tourKey = `arena_tour_seen_${user.id}`;
    const hasSeenTour = localStorage.getItem(tourKey);

    const startTour = () => {
      const steps: any[] = [
        {
          popover: {
            title: "Welcome to Gharpayy Arena!",
            description: "Let's take a quick tour of your new workspace.",
            side: "over",
            align: "center",
          },
        },
        {
          element: "#tour-nav-home",
          popover: {
            title: "Dashboard",
            description: "Your control center. Check your Time, Tasks, and Goals here.",
            side: "right",
            align: "start",
          },
        }
      ];

      if (tier !== "leadership" && actor.appRole !== "admin") {
        steps.push({
          element: `#tour-nav-employee${actor.id.replace(/-/g, "")}`,
          popover: {
            title: "My Profile",
            description: "View your personal attendance history, completed tasks, and edit your details.",
            side: "right",
            align: "start",
          },
        });
      }

      if (isFeatureEnabled("/fly")) {
        steps.push({
          element: "#tour-nav-fly",
          popover: {
            title: "Fly Board",
            description: "Access your workflows, playbooks, and company knowledge base.",
            side: "right",
            align: "start",
          },
        });
      }

      if (isFeatureEnabled("/tasks")) {
        steps.push({
          element: "#tour-nav-tasks",
          popover: {
            title: "Tasks",
            description: "Manage your to-do list and collaborate with your team.",
            side: "right",
            align: "start",
          },
        });
      }

      if (isFeatureEnabled("/console")) {
        steps.push({
          element: "#tour-nav-console",
          popover: {
            title: "Operator Console",
            description: "Your operations command center. Track sprints, send comms, and monitor execution.",
            side: "right",
            align: "start",
          },
        });
      }

      if (tier === "leadership" || tier === "hr") {
        if (isFeatureEnabled("/admin/workforce")) {
          steps.push({
            element: "#tour-nav-adminworkforce",
            popover: {
              title: "Workforce Management",
              description: "Manage your entire organization's employees, roles, and profiles from here.",
              side: "right",
              align: "start",
            },
          });
        }
        if (isFeatureEnabled("/people")) {
          steps.push({
            element: "#tour-nav-people",
            popover: {
              title: "People Directory",
              description: "View and manage all employees across the organization.",
              side: "right",
              align: "start",
            },
          });
        }
      }

      if (tier === "zone_leader" || tier === "leader") {
        if (isFeatureEnabled("/roster")) {
          steps.push({
            element: "#tour-nav-roster",
            popover: {
              title: "Live Roster",
              description: "See exactly who is online, on break, or in the field right now.",
              side: "right",
              align: "start",
            },
          });
        }
        if (isFeatureEnabled("/war-room")) {
          steps.push({
            element: "#tour-nav-warroom",
            popover: {
              title: "War Room",
              description: "Monitor real-time metrics and pipeline to drive daily execution.",
              side: "right",
              align: "start",
            },
          });
        }
      }

      steps.push(
        {
          element: "#tour-search",
          popover: {
            title: "Command Palette",
            description: "Use ⌘K or click here to quickly search across the entire application for employees, features, and settings.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tour-calendar",
          popover: {
            title: "Quick Calendar",
            description: "Peek at your upcoming shifts, tasks, and meetings without leaving your current page.",
            side: "bottom",
            align: "end",
          },
        },
        {
          element: "#tour-notifications",
          popover: {
            title: "Notifications",
            description: "Keep track of important alerts, system updates, and messages from your team.",
            side: "bottom",
            align: "end",
          },
        },
        {
          element: "#tour-profile",
          popover: {
            title: "Your Profile",
            description: "Access your score, settings, or replay this tour anytime from this menu.",
            side: "bottom",
            align: "end",
          },
        }
      );

      const driverObj = driver({
        showProgress: true,
        animate: true,
        popoverClass: "arena-tour-theme",
        steps,
        onDestroyStarted: () => {
          if (!hasSeenTour) {
            localStorage.setItem(tourKey, "true");
          }
          driverObj.destroy();
        },
      });
      driverObj.drive();
    };

    // Auto-start for first-time users
    if (!hasSeenTour) {
      // Delay slightly to allow the app to fully render
      const timeout = setTimeout(() => {
        startTour();
      }, 1000);
      return () => clearTimeout(timeout);
    }

    // Listen for manual triggers from the UI
    window.addEventListener("start-tour", startTour);
    return () => window.removeEventListener("start-tour", startTour);
  }, [user]);

  return null;
}
