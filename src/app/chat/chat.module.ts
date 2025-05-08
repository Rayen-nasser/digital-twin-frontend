import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ChatRoutingModule } from './chat-routing.module';
import { ChatListComponent } from './components/chat-list/chat-list.component';
import { ChatWindowComponent } from './components/chat-window/chat-window.component';
import { ChatInputComponent } from './components/chat-input/chat-input.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { FormsModule } from '@angular/forms';
import { SharedModule } from "../shared/shared.module";
import { ChatViewComponent } from './components/chat-view/chat-view.component';
import { MessageComponent } from './components/message/message.component';

@NgModule({
  declarations: [
    ChatListComponent,
    ChatWindowComponent,
    ChatInputComponent,
    DashboardComponent,
    MessageComponent,
    // ChatViewComponent,
  ],
  imports: [CommonModule, ChatRoutingModule, FormsModule, SharedModule],
})
export class ChatModule {}
