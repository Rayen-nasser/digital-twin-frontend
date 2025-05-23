import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ChatRoutingModule } from './chat-routing.module';
import { ChatListComponent } from './components/chat-list/chat-list.component';
import { ChatWindowComponent } from './components/chat-window/chat-window.component';
import { ChatInputComponent } from './components/chat-input/chat-input.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { FormsModule } from '@angular/forms';
import { SharedModule } from "../shared/shared.module";
import { MessageComponent } from './components/message/message.component';
import { ReportModalComponent } from './components/report-modal/report-modal.component';
import { HeyGenStreamingComponent } from './components/heygen-streaming/heygen-streaming.component';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    ChatListComponent,
    ChatWindowComponent,
    ChatInputComponent,
    DashboardComponent,
    MessageComponent,
    ReportModalComponent,
    HeyGenStreamingComponent
  ],
  imports: [CommonModule, ChatRoutingModule, FormsModule, SharedModule, ReactiveFormsModule],
})
export class ChatModule {}
