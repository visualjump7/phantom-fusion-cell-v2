"use client";

import { type ReactNode } from "react";
import { MODULE_KEYS } from "@/lib/modules";
import { CommsModule } from "./CommsModule";
import { DailyBriefModule } from "./DailyBriefModule";
import { BudgetsModule } from "./BudgetsModule";
import { CashFlowModule } from "./CashFlowModule";
import { ProjectsModule } from "./ProjectsModule";
import { TravelModule } from "./TravelModule";
import { ContactsModule } from "./ContactsModule";
import { CalendarModule } from "./CalendarModule";

export function getModuleContent(key: string): ReactNode {
  switch (key) {
    case MODULE_KEYS.COMMS:
      return <CommsModule />;
    case MODULE_KEYS.DAILY_BRIEF:
      return <DailyBriefModule />;
    case MODULE_KEYS.BUDGETS:
      return <BudgetsModule />;
    case MODULE_KEYS.CASH_FLOW:
      return <CashFlowModule />;
    case MODULE_KEYS.PROJECTS:
      return <ProjectsModule />;
    case MODULE_KEYS.TRAVEL:
      return <TravelModule />;
    case MODULE_KEYS.CONTACTS:
      return <ContactsModule />;
    case MODULE_KEYS.CALENDAR:
      return <CalendarModule />;
    // Dashboard is never opened in the overlay (opensInOverlay=false).
    default:
      return null;
  }
}
