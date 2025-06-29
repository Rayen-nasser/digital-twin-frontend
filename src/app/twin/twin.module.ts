import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CreateTwinComponent } from './components/create-twin/create-twin.component';
import { AuthRoutingModule } from './twin-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { ListTwinComponent } from './components/list-twin/list-twin.component';
import { DetailTwinComponent } from './components/detail-twin/detail-twin.component';
import { SharedModule } from '../shared/shared.module';


@NgModule({
  declarations: [
    ListTwinComponent,
    CreateTwinComponent,
    DetailTwinComponent,
  ],
  imports: [
    CommonModule,
    AuthRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    // Import the module where TwinFormBaseComponent is declared
    SharedModule
  ],
})
export class TwinModule {}
